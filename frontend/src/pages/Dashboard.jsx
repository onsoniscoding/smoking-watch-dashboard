import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  Camera,
  ShieldAlert,
  CalendarDays,
  RefreshCw,
  Trash2,
  Maximize2,
  Radio,
  AlertTriangle
} from 'lucide-react'

import StatCard from '../components/StatCard'
import StatusCard from '../components/StatusCard'
import DetectionTable from '../components/DetectionTable'
import EvidenceModal from '../components/EvidenceModal'

import {
  fetchDetections,
  clearDemoDetections
} from '../services/detectionService'

import {
  fetchStatistics,
  fetchSystemStatus
} from '../services/statisticsService'

export default function Dashboard() {
  const [detections, setDetections] = useState([])
  const [statistics, setStatistics] = useState(null)
  const [system, setSystem] = useState(null)
  const [selected, setSelected] = useState(null)
  const [liveAlert, setLiveAlert] = useState(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [error, setError] = useState('')
  const latestEventIdRef = useRef(null)

  async function loadDashboard() {
    try {
      const [eventResult, statsResult, systemResult] =
        await Promise.all([
          fetchDetections({ limit: 100 }),
          fetchStatistics(),
          fetchSystemStatus()
        ])

      const list = eventResult.data || []
      if (list.length > 0) {
        const newest = list[0]
        if (
          latestEventIdRef.current !== null &&
          newest.event_id !== latestEventIdRef.current
        ) {
          setLiveAlert(newest)
        }
        latestEventIdRef.current = newest.event_id
      } else {
        latestEventIdRef.current = ''
      }

      setDetections(list)
      setStatistics(statsResult.data)
      setSystem(systemResult.data)
      setError('')
    } catch (err) {
      console.error(err)
      setError('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ Backend ได้ กรุณาตรวจสอบการรันเซิร์ฟเวอร์')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()

    const timer = setInterval(loadDashboard, 2000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!liveAlert) return
    const t = setTimeout(() => setLiveAlert(null), 6000)
    return () => clearTimeout(t)
  }, [liveAlert])

  async function handleResetDemo() {
    try {
      setResetting(true)
      await clearDemoDetections()
      latestEventIdRef.current = ''
      setLiveAlert(null)
      setConfirmReset(false)
      await loadDashboard()
    } catch (err) {
      console.error(err)
      setError('ล้างข้อมูลตัวอย่างไม่สำเร็จ')
    } finally {
      setResetting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-slate-500">
        กำลังโหลดข้อมูลระบบ...
      </div>
    )
  }

  const latestWithImage = detections.find((item) => Boolean(item.evidence_url)) || detections[0]

  return (
    <div className="p-8 space-y-6 relative">
      {liveAlert && (
        <div className="fixed top-24 right-8 z-40 bg-rose-600 text-white px-5 py-4 rounded-2xl shadow-2xl flex items-center gap-3.5 animate-bounce">
          <AlertTriangle size={24} className="shrink-0" />
          <div className="text-sm">
            <p className="font-bold">
              ตรวจพบการสูบบุหรี่ใหม่! (ความมั่นใจ {(liveAlert.confidence * 100).toFixed(1)}%)
            </p>
            <p className="text-rose-100 text-xs mt-0.5">
              {liveAlert.camera_name} • {liveAlert.event_id}
            </p>
          </div>
          <button
            onClick={() => {
              setSelected(liveAlert)
              setLiveAlert(null)
            }}
            className="ml-2 bg-white/20 hover:bg-white/30 text-xs font-semibold px-3 py-1.5 rounded-lg"
          >
            ดูภาพหลักฐาน
          </button>
        </div>
      )}

      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            ภาพรวมระบบ
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            ติดตามผลการตรวจจับผู้สูบบุหรี่แบบเรียลไทม์จากโปรแกรม CiRA CORE (`lopo.npj`)
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {confirmReset ? (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl">
              <span className="text-xs font-medium text-rose-700">ยืนยันล้างข้อมูล?</span>
              <button
                onClick={handleResetDemo}
                disabled={resetting}
                className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 disabled:opacity-50"
              >
                {resetting ? 'กำลังล้าง...' : 'ยืนยัน'}
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="px-2 py-1 text-slate-600 hover:text-slate-900 text-xs"
              >
                ยกเลิก
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmReset(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-rose-200 text-rose-600 rounded-xl text-sm hover:bg-rose-50"
            >
              <Trash2 size={16} />
              ล้างข้อมูลเริ่มเดโม่
            </button>
          )}

          <button
            onClick={loadDashboard}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm hover:bg-slate-50"
          >
            <RefreshCw size={16} />
            รีเฟรชข้อมูล
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard
          title="ตรวจพบทั้งหมด"
          value={statistics?.total_detections ?? 0}
          description="เหตุการณ์ที่บันทึกสะสมทั้งหมด"
          icon={Activity}
        />

        <StatCard
          title="ตรวจพบวันนี้"
          value={statistics?.today_detections ?? 0}
          description="เหตุการณ์ที่ตรวจพบในวันนี้"
          icon={CalendarDays}
        />

        <StatCard
          title="จุดตรวจจับที่พบเหตุ"
          value={Object.keys(statistics?.camera_counts || {}).length}
          description="จำนวนกล้อง / ช่องสัญญาณคลิปวิดีโอ"
          icon={Camera}
        />

        <StatCard
          title="ผ่านเกณฑ์ยืนยัน (Smoke Gate)"
          value={statistics?.gate_passed_count ?? 0}
          description="เหตุการณ์ที่ยืนยันการสูบบุหรี่ชัดเจน"
          icon={ShieldAlert}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Radio size={18} className="text-emerald-600" />
              <div>
                <h3 className="font-semibold text-slate-800">
                  ภาพตรวจจับล่าสุดจาก CiRA CORE
                </h3>
                <p className="text-xs text-slate-400">
                  อัปเดตอัตโนมัติทุก 2 วินาทีขณะเปิดรันวิดีโอใน CiRA CORE
                </p>
              </div>
            </div>

            {latestWithImage && (
              <button
                onClick={() => setSelected(latestWithImage)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg"
              >
                <Maximize2 size={14} />
                ขยายดูภาพ {latestWithImage.event_id}
              </button>
            )}
          </div>

          {latestWithImage?.evidence_url ? (
            <div className="relative bg-slate-950 flex-1 min-h-[290px] flex items-center justify-center">
              <img
                src={latestWithImage.evidence_url}
                alt={latestWithImage.event_id}
                className="max-h-[340px] w-full object-contain"
              />
              <div className="absolute bottom-3 left-3 right-3 bg-slate-900/85 backdrop-blur-sm text-white px-4 py-2.5 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                <span>
                  <strong>{latestWithImage.camera_name}</strong> • {new Date(latestWithImage.timestamp).toLocaleString('th-TH')}
                </span>
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-md font-semibold">
                    ความมั่นใจ: {(latestWithImage.confidence * 100).toFixed(1)}%
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-md font-semibold ${
                    latestWithImage.smoke_mandatory_gate
                      ? 'bg-emerald-600 text-white'
                      : 'bg-amber-600 text-white'
                  }`}>
                    {latestWithImage.smoke_mandatory_gate ? 'ผ่านเกณฑ์ยืนยัน' : 'รอตรวจสอบ'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-[260px] flex flex-col items-center justify-center text-slate-400 p-8 text-center">
              <Camera size={36} className="mb-2 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">
                กำลังรอภาพตรวจจับจากโปรแกรม CiRA CORE
              </p>
              <p className="text-xs text-slate-400 mt-1">
                เปิดโปรแกรม CiRA CORE โหลดไฟล์ lopo.npj แล้วกดเปิด AutoRun เพื่อส่งภาพขึ้นแสดงสดที่นี่
              </p>
            </div>
          )}
        </div>

        <StatusCard status={system} />
      </div>

      <DetectionTable
        detections={detections.slice(0, 8)}
        onSelect={setSelected}
      />

      <EvidenceModal
        selected={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}
