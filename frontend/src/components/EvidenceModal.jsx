import { X, ShieldCheck, ShieldAlert, EyeOff } from 'lucide-react'

const objNameLabels = {
  person: 'บุคคล',
  smoking_person: 'คนสูบบุหรี่',
  smoker: 'คนสูบบุหรี่',
  cigarette: 'มวนบุหรี่',
  smoke: 'กลุ่มควัน'
}

export default function EvidenceModal({ selected, onClose }) {
  if (!selected) return null

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
            <span>
              {selected.evidence_review_required
                ? 'ซ่อนภาพหลักฐานชั่วคราวเพื่อรอการยืนยันการเบลอใบหน้า'
                : 'ไม่มีภาพหลักฐานแนบมาในรายการทดสอบนี้'}
            </span>
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
                <ShieldCheck size={16} /> ผ่านเกณฑ์ยืนยัน
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

        <button
          onClick={onClose}
          className="mt-6 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-medium transition"
        >
          ปิดหน้าต่าง
        </button>
      </div>
    </div>
  )
}
