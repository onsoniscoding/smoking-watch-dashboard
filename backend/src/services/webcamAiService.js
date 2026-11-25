import { spawn } from 'child_process'
import http from 'http'

const CMD_LINE = 'call C:\\opt\\ros\\melodic\\x64\\setup.bat >nul 2>&1 && C:\\opt\\ros\\melodic\\x64\\python.exe -u D:\\SmokeDetect\\cira_core_bridge\\webcam_daemon.py'
const DAEMON_PORT = 3099

let daemonProc = null
let daemonReadyPromise = null
let stdoutBuffer = ''

function pingExistingDaemon() {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${DAEMON_PORT}/status`, (res) => {
      let raw = ''
      res.on('data', (c) => { raw += c.toString('utf8') })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw)
          resolve(Boolean(res.statusCode === 200 && parsed?.ok))
        } catch {
          resolve(false)
        }
      })
    })
    req.on('error', () => resolve(false))
    req.setTimeout(600, () => {
      req.destroy()
      resolve(false)
    })
  })
}

export async function ensureWebcamDaemon() {
  if (await pingExistingDaemon()) {
    return true
  }

  if (daemonReadyPromise) {
    return daemonReadyPromise
  }

  daemonReadyPromise = new Promise((resolve, reject) => {
    stdoutBuffer = ''
    daemonProc = spawn('cmd.exe', ['/d', '/s', '/c', CMD_LINE], {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let initialized = false

    const startupTimeout = setTimeout(() => {
      if (!initialized) {
        daemonProc?.kill()
        daemonProc = null
        daemonReadyPromise = null
        reject(new Error('Timed out initializing 30-FPS CiRA CUDA stream engine'))
      }
    }, 15000)

    daemonProc.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString('utf8')
      let nlIdx
      while ((nlIdx = stdoutBuffer.indexOf('\n')) !== -1) {
        const line = stdoutBuffer.slice(0, nlIdx).trim()
        stdoutBuffer = stdoutBuffer.slice(nlIdx + 1)
        if (!line || !line.startsWith('{')) continue
        try {
          const parsed = JSON.parse(line)
          if (!initialized && parsed.ready) {
            initialized = true
            clearTimeout(startupTimeout)
            resolve(true)
          }
        } catch {
          // ignore Darknet init logs
        }
      }
    })

    daemonProc.stderr.on('data', (chunk) => {
      const msg = chunk.toString('utf8').trim()
      if (msg) console.error('[WebcamDaemon stderr]:', msg)
    })

    daemonProc.on('exit', async () => {
      clearTimeout(startupTimeout)
      daemonProc = null
      daemonReadyPromise = null
      if (!initialized) {
        if (await pingExistingDaemon()) {
          initialized = true
          resolve(true)
        } else {
          reject(new Error('Webcam daemon exited unexpectedly'))
        }
      }
    })

    daemonProc.on('error', (err) => {
      clearTimeout(startupTimeout)
      daemonProc = null
      daemonReadyPromise = null
      if (!initialized) reject(err)
    })
  })

  return daemonReadyPromise
}

export async function fetchDaemonJson(pathAndQuery) {
  await ensureWebcamDaemon()
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${DAEMON_PORT}${pathAndQuery}`, (res) => {
      let raw = ''
      res.on('data', (c) => { raw += c.toString('utf8') })
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw))
        } catch (err) {
          reject(err)
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(5000, () => {
      req.destroy(new Error('Daemon status timeout'))
    })
  })
}

export async function proxyMjpegStream(req, res, camIndex = 0, autoRecord = true) {
  await ensureWebcamDaemon()
  const upstreamUrl = `http://127.0.0.1:${DAEMON_PORT}/stream?cam=${Number(camIndex) || 0}&record=${autoRecord ? 1 : 0}`
  const upReq = http.get(upstreamUrl, (upRes) => {
    if (upRes.statusCode !== 200) {
      res.status(upRes.statusCode || 500)
      upRes.pipe(res)
      return
    }
    res.writeHead(200, {
      'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      Connection: 'close'
    })
    upRes.pipe(res)
  })

  upReq.on('error', (err) => {
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: err.message })
    } else {
      res.end()
    }
  })

  req.on('close', () => {
    upReq.destroy()
  })
}
