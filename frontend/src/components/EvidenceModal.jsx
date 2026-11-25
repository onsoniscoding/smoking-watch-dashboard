import { useState } from 'react'
import { X, ShieldCheck, ShieldAlert, EyeOff, CheckCircle2, Trash2 } from 'lucide-react'
import { reviewDetection } from '../services/detectionService'

const objNameLabels = {
  person: 'บุคคล',
  smoking_person: 'คนสูบบุหรี่',
  smoker: 'คนสูบบุหรี่',
  cigarette: 'มวนบุหรี่',
  smoke: 'กลุ่มควัน'
}

export default function EvidenceModal({ selected, onClose, onReviewed }) {
  const [submitting, setSubmitting] = useState(false)

  if (!selected) return null

  async function handleReview(action) {
    try {
      setSubmitting(true)
      const res = await reviewDetection(selected.event_id, action)
      if (onReviewed) {
        await onReviewed(res?.data, action)
      }
      if (action === 'reject') {
        onClose()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-bold text-lg text-slate-800">
              รายละเอียดการตรวจจับ — {selected.event_id}
            </h3>
            <p className="text-xs text-slate-500">
              {new Date(selected.timestamp).toLocaleString('th-TH')} • แหล่งข้อมูล: {selected.source || 'CiRA CORE'}
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-900 p-1"
            aria-label="ปิดหน้าต่าง"
          >
            <X size={20} />
          </button>
        </div>

        {selected.evidence_url ? (
          <div className="mb-5 rounded-xl overflow-hidden border border-slate-200 bg-slate-900">
            <img
              src={selected.evidence_url}
              alt={`ภาพหลักฐาน ${selected.event_id}`}
              className="w-full max-h-96 object-contain mx-auto"
            />
          </div>
        ) : (
          <div className="mb-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-500 text-sm flex flex-col items-center gap-2">
            <EyeOff size={24} className="text-slate-400" />
            <span>ไม่มีภาพหลักฐานแนบมาในรายการนี้</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm bg-slate-50 p-4 rounded-xl border border-slate-100">
          <p><strong>จุดติดตั้ง / กล้อง:</strong> {selected.camera_name} ({selected.camera_id})</p>
          <p><strong>ประเภทเหตุการณ์:</strong> {selected.event_type === 'smoking' ? 'สูบบุหรี่' : selected.event_type}</p>
          <p><strong>ความมั่นใจของ AI:</strong> {(selected.confidence * 100).toFixed(1)}%</p>
          <p className="flex items-center gap-1.5">
            <strong>เกณฑ์ยืนยัน (Smoke Gate):</strong>{' '}
            {selected.smoke_mandatory_gate ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                <ShieldCheck size={16} /> ผ่านเกณฑ์ยืนยัน{selected.reviewed_by_admin ? ' (ผู้ดูแลยืนยันแล้ว)' : ''}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                <ShieldAlert size={16} /> รอตรวจสอบเพิ่มเติม
              </span>
            )}
          </p>
        </div>

        {Array.isArray(selected.detected_objects) && selected.detected_objects.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 mb-2">
              วัตถุที่ตรวจพบโดย CiRA CORE
            </p>
            <div className="flex flex-wrap gap-2">
              {selected.detected_objects.map((obj, idx) => (
                <span
                  key={idx}
                  className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg font-medium"
                >
                  {objNameLabels[obj.name] || obj.name}: {(Number(obj.confidence) * 100).toFixed(1)}%
                </span>
              ))}
            </div>
          </div>
        )}

        {!selected.smoke_mandatory_gate ? (
          <div className="mt-5 p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
            <div>
              <p className="text-sm font-semibold text-amber-900">
                ตรวจสอบภาพหลักฐานโดยผู้ดูแลระบบ
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                รายการนี้ยังไม่พบกลุ่มควันชัดเจน กรุณาตรวจสอบจากภาพด้านบนแล้วเลือกผลการพิจารณา
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => handleReview('approve')}
                disabled={submitting}
                className="flex-1 min-w-[180px] inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-2.5 px-4 rounded-xl text-sm font-semibold transition"
              >
                <CheckCircle2 size={18} />
                ยืนยันว่าสูบบุหรี่จริง
              </button>
              <button
                onClick={() => handleReview('reject')}
                disabled={submitting}
                className="flex-1 min-w-[180px] inline-flex items-center justify-center gap-2 bg-white hover:bg-rose-50 disabled:opacity-50 text-rose-600 border border-rose-200 py-2.5 px-4 rounded-xl text-sm font-semibold transition"
              >
                <Trash2 size={17} />
                ไม่ใช่การสูบ (ลบรายการ)
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => handleReview('reject')}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 px-3 py-1.5 rounded-lg hover:bg-rose-50 transition disabled:opacity-50"
            >
              <Trash2 size={15} />
              ลบรายการบันทึกนี้
            </button>
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl font-medium transition"
        >
          ปิดหน้าต่าง
        </button>
      </div>
    </div>
  )
}
