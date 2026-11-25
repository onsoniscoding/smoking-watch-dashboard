import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'

import {
  fetchStatistics
} from '../services/statisticsService'

export default function Statistics() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  async function loadStatistics() {
    try {
      const result = await fetchStatistics()
      setStats(result.data)
      setError('')
    } catch (err) {
      console.error(err)
      setError('ไม่สามารถโหลดข้อมูลสถิติได้')
    }
  }

  useEffect(() => {
    loadStatistics()

    const timer = setInterval(loadStatistics, 4000)
    return () => clearInterval(timer)
  }, [])

  const cameraData = Object.entries(
    stats?.camera_counts || {}
  ).map(([camera, count]) => ({
    camera,
    count
  }))

  const gateData = [
    { label: 'ผ่านเกณฑ์ยืนยัน', count: stats?.gate_passed_count ?? 0, color: '#10b981' },
    { label: 'รอตรวจสอบเพิ่มเติม', count: stats?.gate_failed_count ?? 0, color: '#f59e0b' }
  ]

  const total = stats?.total_detections ?? 0
  const passRate = total > 0
    ? (((stats?.gate_passed_count ?? 0) / total) * 100).toFixed(1)
    : '0.0'

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          สถิติและการวิเคราะห์ข้อมูล
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          สรุปจำนวนการตรวจพบการสูบบุหรี่แยกตามจุดติดตั้งและอัตราการผ่านเกณฑ์ยืนยันจาก AI
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <p className="text-sm text-slate-500">
            ตรวจพบสะสมทั้งหมด
          </p>
          <p className="text-4xl font-bold mt-3 text-slate-800">
            {stats?.total_detections ?? 0}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <p className="text-sm text-slate-500">
            ตรวจพบในวันนี้
          </p>
          <p className="text-4xl font-bold mt-3 text-slate-800">
            {stats?.today_detections ?? 0}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <p className="text-sm text-slate-500">
            อัตราการผ่านเกณฑ์ยืนยัน (Smoke Gate)
          </p>
          <p className="text-4xl font-bold mt-3 text-emerald-600">
            {passRate}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-semibold mb-6 text-slate-800">
            จำนวนการตรวจพบแยกตามจุดติดตั้ง / ช่องสัญญาณ
          </h3>

          {cameraData.length === 0 ? (
            <p className="text-sm text-slate-400">
              ยังไม่มีข้อมูลจากกล้องในขณะนี้
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={cameraData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="camera" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(val) => [`${val} ครั้ง`, 'จำนวนที่ตรวจพบ']} />
                <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-semibold mb-6 text-slate-800">
            สัดส่วนการยืนยันผลตรวจจับ (Smoke Gate)
          </h3>

          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={gateData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip formatter={(val) => [`${val} รายการ`, 'จำนวน']} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {gateData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
