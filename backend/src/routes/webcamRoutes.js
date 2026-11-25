import { Router } from 'express'
import {
  fetchDaemonJson,
  proxyMjpegStream
} from '../services/webcamAiService.js'

const router = Router()

router.get('/webcam/stream', async (req, res) => {
  try {
    const camIndex = Number(req.query.cam ?? 0)
    const autoRecord = req.query.record !== '0'
    await proxyMjpegStream(req, res, camIndex, autoRecord)
  } catch (err) {
    console.error('MJPEG stream error:', err)
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: err.message })
    }
  }
})

router.get('/webcam/status', async (req, res) => {
  try {
    const q = req.query.record !== undefined ? `?record=${req.query.record}` : ''
    const data = await fetchDaemonJson(`/status${q}`)
    return res.json({ success: true, data })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
})

router.post('/webcam/stop', async (req, res) => {
  try {
    const data = await fetchDaemonJson('/stop')
    return res.json({ success: true, data })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
})

export default router
