import { useEffect, useMemo, useState } from 'react'
import { Search, RefreshCw, Eye, Download, CheckCircle2, Trash2 } from 'lucide-react'

import { fetchDetections, reviewDetection } from '../services/detectionService'
import EvidenceModal from '../components/EvidenceModal'

export default function DetectionLogs() {
  const [detections, setDetections] = useState([])
  const [search, setSearch] = useState('')
  const [camera, setCamera] = useState('all')
  const [gateFilter, setGateFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadData() {
    try {
      const result = await fetchDetections({ limit: 500 })
      setDetections(result.data || [])
      setError('')
    } catch (err) {
      console.error(err)
      setError('ไม่สามารถโหลดประวัติการตรวจจับได้')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    const timer = setInterval(loadData, 2500)
    return () => clearInterval(timer)
  }, [])

  const cameras = [
    ...new Set(detections.map((item) => item.camera_id))
  ]

  const filtered = useMemo(() => {
    return detections.filter((item) => {
      const text = search.toLowerCase()

      const matchesSearch =
        item.event_id.toLowerCase().includes(text) ||
        item.camera_id.toLowerCase().includes(text) ||
        item.camera_name.toLowerCase().includes(text)

      const matchesCamera =
        camera === 'all' || item.camera_id === camera

      const matchesGate =
        gateFilter === 'all' ||
        (gateFilter === 'passed' && item.smoke_mandatory_gate === true) ||
        (gateFilter === 'not_passed' && item.smoke_mandatory_gate !== true)

      return matchesSearch && matchesCamera && matchesGate
    })
  }, [detections, search, camera, gateFilter])

  function exportCsv() {
    const headers = ['รหัสเหตุการณ์', 'วันเวลา', 'รหัสกล้อง', 'ชื่อจุดติดตั้ง', 'ความมั่นใจ (%)', 'เกณฑ์ยืนยัน']
    const rows = filtered.map((item) => [
      item.event_id,
      item.timestamp,
      item.camera_id,
      `"${String(item.camera_name || '').replace(/"/g, '""')}"`,
      (item.confidence * 100).toFixed(1),
      item.smoke_mandatory_gate ? 'ผ่านเกณฑ์' : 'รอตรวจสอบ'
    ])
    const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `รายงานตรวจจับการสูบบุหรี่-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            ประวัติการตรวจจับทั้งหมด
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            ค้นหา กรองข้อมูล และตรวจสอบภาพหลักฐานการตรวจจับจากระบบ AI
          </p>
        </div>

        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-xl"
        >
          <Download size={16} />
          ส่งออกไฟล์ CSV
        </button>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-3.5 text-slate-400"
            size={18}
          />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ค้นหารหัสเหตุการณ์ หรือ ชื่อกล้อง..."
            className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-emerald-300"
          />
        </div>

        <select
          value={camera}
          onChange={(event) => setCamera(event.target.value)}
          className="border border-slate-200 rounded-xl px-4 py-3 bg-white text-sm"
        >
          <option value="all">กล้องทุกจุดติดตั้ง</option>
          {cameras.map((id) => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>

        <select
          value={gateFilter}
          onChange={(event) => setGateFilter(event.target.value)}
          className="border border-slate-200 rounded-xl px-4 py-3 bg-white text-sm"
        >
          <option value="all">สถานะการยืนยันทั้งหมด</option>
          <option value="passed">เฉพาะที่ผ่านเกณฑ์ยืนยัน</option>
          <option value="not_passed">เฉพาะที่รอตรวจสอบ</option>
        </select>

        <button
          onClick={loadData}
          className="flex items-center justify-center gap-2 border border-slate-200 rounded-xl px-4 py-3 hover:bg-slate-50 text-sm"
        >
          <RefreshCw size={17} />
          รีเฟรช
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl">
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800">รายการบันทึกทั้งหมด</h3>
          <span className="text-sm text-slate-500">
            ทั้งหมด {filtered.length} รายการ
          </span>
        </div>

        {loading ? (
          <p className="p-6 text-slate-500">กำลังโหลดข้อมูล...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-4">ภาพตัวอย่าง</th>
                  <th className="p-4">รหัสเหตุการณ์</th>
                  <th className="p-4">วันและเวลา</th>
                  <th className="p-4">จุดติดตั้ง / กล้อง</th>
                  <th className="p-4">ความมั่นใจ</th>
                  <th className="p-4">เกณฑ์ยืนยัน</th>
                  <th className="p-4">การจัดการ / ดูหลักฐาน</th>
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-slate-400">
                      ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr key={item.event_id} className="border-t border-slate-100 hover:bg-slate-50/70">
                      <td className="p-3">
                        {item.evidence_url ? (
                          <button onClick={() => setSelected(item)} className="block">
                            <img
                              src={item.evidence_url}
                              alt={item.event_id}
                              className="w-20 h-12 object-cover rounded-lg border border-slate-200"
                            />
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">ไม่มีภาพ</span>
                        )}
                      </td>

                      <td className="p-4 font-medium text-slate-800">
                        {item.event_id}
                      </td>

                      <td className="p-4 text-slate-500">
                        {new Date(item.timestamp).toLocaleString('th-TH')}
                      </td>

                      <td className="p-4">{item.camera_name}</td>

                      <td className="p-4 font-semibold text-slate-700">
                        {(item.confidence * 100).toFixed(1)}%
                      </td>

                      <td className="p-4">
                        {item.smoke_mandatory_gate ? (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700">
                            ผ่านเกณฑ์ยืนยัน{item.reviewed_by_admin ? ' ✓' : ''}
                          </span>
                        ) : (
                          <button
                            onClick={() => setSelected(item)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition"
                            title="คลิกเพื่อเปิดดูภาพและตรวจสอบ"
                          >
                            รอตรวจสอบเพิ่มเติม
                          </button>
                        )}
                      </td>

                      <td className="p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => setSelected(item)}
                            className="inline-flex items-center gap-1.5 text-emerald-600 hover:text-emerald-800 font-medium text-xs px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 transition"
                            aria-label={`ดูรายละเอียด ${item.event_id}`}
                          >
                            <Eye size={16} />
                            {item.smoke_mandatory_gate ? 'ดูภาพ' : 'ตรวจภาพ'}
                          </button>

                          {!item.smoke_mandatory_gate && (
                            <>
                              <button
                                onClick={async () => {
                                  await reviewDetection(item.event_id, 'approve')
                                  await loadData()
                                }}
                                className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg transition"
                                title="ยืนยันว่าสูบบุหรี่จริง"
                              >
                                <CheckCircle2 size={14} />
                                ยืนยัน
                              </button>
                              <button
                                onClick={async () => {
                                  await reviewDetection(item.event_id, 'reject')
                                  await loadData()
                                }}
                                className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 px-2 py-1.5 rounded-lg transition"
                                title="ไม่ใช่การสูบ (ลบรายการ)"
                              >
                                <Trash2 size={14} />
                                ลบ
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <EvidenceModal
        selected={selected}
        onClose={() => setSelected(null)}
        onReviewed={async (result, action) => {
          if (action === 'approve' && result?.detection) {
            setSelected(result.detection)
          }
          await loadData()
        }}
      />
    </div>
  )
}
