import { useEffect, useRef, useState } from 'react'
import {
  Video,
  VideoOff,
  Camera,
  ShieldCheck,
  AlertTriangle,
  Cpu,
  Gauge
} from 'lucide-react'
import api from '../services/api'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export default function LiveWebcam() {
  const [camIndex, setCamIndex] = useState(0)
  const [streaming, setStreaming] = useState(false)
  const [streamSession, setStreamSession] = useState(0)
  const [autoRecord, setAutoRecord] = useState(true)
  const [statusData, setStatusData] = useState(null)
  const [error, setError] = useState('')
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      api.post('/webcam/stop').catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!streaming) return
    let active = true

    async function syncStatus() {
      try {
        const res = await api.get('/webcam/status', {
          params: { record: autoRecord ? '1' : '0' }
        })
        if (active && res?.data?.data) {
          setStatusData(res.data.data)
        }
      } catch {
        // ignore transient status poll
      }
    }

    syncStatus()
    const t = setInterval(syncStatus, 800)
    return () => {
      active = false
      clearInterval(t)
    }
  }, [streaming, autoRecord])

  async function stopWebcam() {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    setStreaming(false)
    setStatusData(null)
    try {
      await api.post('/webcam/stop')
    } catch {
      // ignore stop error
    }
  }

  async function startWebcam() {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    retryCountRef.current = 0
    setError('')
    try {
      await api.get('/webcam/status', {
        params: { record: autoRecord ? '1' : '0' }
      })
    } catch {
      // continue to mount MJPEG stream
    }
    setStreamSession(Date.now())
    setStreaming(true)
  }

  const streamUrl = streaming
    ? `${API_BASE}/webcam/stream?cam=${camIndex}&t=${streamSession}`
    : ''

  const recentEvents = statusData?.recent_events || []
  const fps = statusData?.fps || 0

  let bannerText = 'พร้อมเปิดกล้องสตรีมสดความเร็วสูง (30 FPS MJPEG)'
  if (streaming) {
    if ((statusData?.objects || []).length > 0) {
      bannerText = 'ตรวจพบวัตถุต้องสงสัย กำลังยืนยันต่อเนื่องหลายเฟรม...'
    } else if (statusData?.person) {
      bannerText = `กำลังสตรีมสดลื่นไหล (${fps > 0 ? `${fps} FPS` : 'กำลังเชื่อมต่อ'}) • พบบุคคล ${(statusData.person.confidence * 100).toFixed(0)}%`
    } else if (fps > 0) {
      bannerText = `กำลังสตรีมสดลื่นไหล ${fps} FPS (ไม่พบผู้สูบบุหรี่)`
    } else {
      bannerText = 'กำลังเริ่มต้นสตรีมกล้องความเร็วสูงและเอนจิน CiRA CUDA...'
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            กล้องเว็บแคม
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            ตรวจจับการสูบบุหรี่จากกล้องเว็บแคมแบบเรียลไทม์อย่างลื่นไหลไม่กระตุก
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={camIndex}
            onChange={(e) => setCamIndex(Number(e.target.value))}
            disabled={streaming}
            className="border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white text-sm"
          >
            <option value={0}>กล้องหลัก (Index 0 — USB2.0 HD UVC WebCam)</option>
            <option value={1}>กล้องสำรอง (Index 1 — USB External)</option>
          </select>

          {!streaming ? (
            <button
              onClick={startWebcam}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm"
            >
              <Video size={18} />
              เปิดกล้องเริ่มตรวจจับสด
            </button>
          ) : (
            <button
              onClick={stopWebcam}
              className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm"
            >
              <VideoOff size={18} />
              ปิดกล้อง
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  streaming ? 'bg-emerald-500 animate-ping' : 'bg-slate-300'
                }`}
              />
              <span className="font-semibold text-slate-800 text-sm">
                {bannerText}
              </span>
            </div>

            <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoRecord}
                onChange={(e) => setAutoRecord(e.target.checked)}
                className="accent-emerald-600 w-4 h-4"
              />
              บันทึกเหตุการณ์เข้าสู่ระบบอัตโนมัติ
            </label>
          </div>

          <div className="relative bg-slate-950 aspect-video flex items-center justify-center overflow-hidden">
            {streaming ? (
              <img
                src={streamUrl}
                alt="Smooth MJPEG Webcam Stream"
                onLoad={() => {
                  retryCountRef.current = 0
                  setError('')
                }}
                onError={() => {
                  if (retryCountRef.current < 2) {
                    retryCountRef.current += 1
                    retryTimerRef.current = setTimeout(() => {
                      setStreamSession(Date.now())
                    }, 700)
                    return
                  }
                  setError('ไม่สามารถเปิดสัญญาณภาพจากกล้องได้ กรุณาตรวจสอบว่าไม่มีโปรแกรมอื่นเปิดกล้องค้างไว้')
                  setStreaming(false)
                }}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center p-8 text-slate-400">
                <Camera size={48} className="mx-auto mb-3 text-slate-600" />
                <p className="text-base font-medium text-slate-300">
                  กล้องเว็บแคมยังไม่ได้เปิดใช้งาน
                </p>
                <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto">
                  กดปุ่ม &ldquo;เปิดกล้องเริ่มตรวจจับสด&rdquo; เพื่อเริ่มสตรีมภาพสดแบบต่อเนื่องลื่นไหล (Hardware MJPEG Stream) พร้อมตีกรอบ AI อัตโนมัติ
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                <Cpu size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">
                  สถานะการประมวลผลสด
                </h3>
                <p className="text-xs text-slate-400">
                  วิดีโอแยกเธรดอิสระ ไม่สะดุดตามจังหวะ AI
                </p>
              </div>
            </div>

            <div className="space-y-2.5 text-sm bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 inline-flex items-center gap-1.5">
                  <Gauge size={15} /> เฟรมเรตภาพสด:
                </span>
                <span className="font-bold text-emerald-600">
                  {streaming && fps > 0 ? `${fps} FPS` : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">การตรวจพบบุคคล:</span>
                <span className="font-semibold text-slate-800">
                  {statusData?.person
                    ? `พบ (${(statusData.person.confidence * 100).toFixed(0)}%)`
                    : 'ยังไม่พบ'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-3">
              เหตุการณ์ที่บันทึกจากเว็บแคมในรอบนี้
            </h3>

            {recentEvents.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                ยังไม่มีการบันทึกเหตุการณ์สูบบุหรี่จากรอบเปิดกล้องปัจจุบัน
              </p>
            ) : (
              <div className="space-y-2.5">
                {recentEvents.map((ev) => (
                  <div
                    key={ev.event_id}
                    className="flex items-center justify-between text-xs p-3 rounded-xl bg-amber-50 border border-amber-200"
                  >
                    <div className="flex items-center gap-2">
                      {ev.gate ? (
                        <ShieldCheck size={16} className="text-emerald-600" />
                      ) : (
                        <AlertTriangle size={16} className="text-amber-600" />
                      )}
                      <div>
                        <p className="font-semibold text-slate-800">{ev.event_id}</p>
                        <p className="text-slate-500">เวลา {ev.time}</p>
                      </div>
                    </div>
                    <span className="font-bold text-amber-800">
                      {(ev.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
