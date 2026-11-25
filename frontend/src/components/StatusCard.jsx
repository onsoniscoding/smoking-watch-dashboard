import { Cpu, CheckCircle2, Clock } from 'lucide-react'

export default function StatusCard({ status }) {
  const online = status?.status === 'online'

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 flex flex-col justify-between h-full">
      <div>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <Cpu size={20} />
            </div>
            <h3 className="font-semibold text-slate-800">
              สถานะระบบ AI
            </h3>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
              online
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                online ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            {online ? 'ออนไลน์ (กำลังประมวลผล)' : 'พร้อมทำงาน (รอสัญญาณ)'}
          </span>
        </div>

        <p className="text-sm font-medium text-slate-700 mt-4">
          CiRA CORE — โมเดลตรวจจับสองจังหวะ (คน + บุหรี่/ควัน)
        </p>
        <p className="text-xs text-slate-500 mt-1">
          {online
            ? 'กำลังรับภาพและผลตรวจจับสดจากไฟล์โปรเจกต์ lopo.npj'
            : 'เปิดโปรแกรม CiRA CORE แล้วกดรัน lopo.npj เพื่อเริ่มส่งข้อมูลเข้าเว็บ'}
        </p>
      </div>

      <div className="mt-5 pt-4 border-t border-slate-100 space-y-2.5 text-xs text-slate-500">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-600" />
            ตัวกรองยืนยันการสูบ (Smoke Gate)
          </span>
          <span className="font-medium text-emerald-700">เปิดใช้งาน</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5">
            <Clock size={14} className="text-slate-400" />
            สัญญาณเชื่อมต่อล่าสุด
          </span>
          <span className="font-medium text-slate-700">
            {status?.last_heartbeat
              ? new Date(status.last_heartbeat).toLocaleString('th-TH')
              : 'ยังไม่มีสัญญาณ'}
          </span>
        </div>
      </div>
    </div>
  )
}
