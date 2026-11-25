import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, ShieldCheck } from 'lucide-react'
import { fetchStatistics } from '../services/statisticsService'

const titles = {
  '/': 'ภาพรวมการเฝ้าระวัง',
  '/webcam': 'กล้องเว็บแคมตรวจจับสด',
  '/logs': 'ประวัติการตรวจจับทั้งหมด',
  '/statistics': 'สถิติและการวิเคราะห์ข้อมูล'
}

export default function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const title = titles[location.pathname] || 'Smoke Watch'
  const [todayCount, setTodayCount] = useState(0)

  useEffect(() => {
    let active = true
    async function syncCount() {
      try {
        const res = await fetchStatistics()
        if (active) {
          setTodayCount(res?.data?.today_detections ?? 0)
        }
      } catch {
        // ignore transient network errors
      }
    }
    syncCount()
    const timer = setInterval(syncCount, 3000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  return (
    <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between">
      <div>
        <h2 className="text-xl font-bold text-slate-800">
          {title}
        </h2>
        <p className="text-sm text-slate-500">
          ระบบตรวจจับผู้สูบบุหรี่อัตโนมัติด้วย CiRA CORE AI
        </p>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <img
          src="/spu-logo.png"
          alt="SPU Logo"
          className="h-9 w-auto object-contain hidden sm:block pr-3 border-r border-slate-200"
        />

        <button
          onClick={() => navigate('/logs')}
          className="relative p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition"
          title="ดูประวัติการตรวจจับ"
          aria-label="ดูประวัติการตรวจจับ"
        >
          <Bell size={20} />
          {todayCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-rose-600 text-white text-[11px] font-bold rounded-full flex items-center justify-center">
              {todayCount > 99 ? '99+' : todayCount}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2 whitespace-nowrap">
          <div className="bg-emerald-100 p-2 rounded-full">
            <ShieldCheck className="text-emerald-700" size={20} />
          </div>
          <span className="text-sm font-medium text-slate-700">
            ผู้ดูแลระบบ
          </span>
        </div>
      </div>
    </header>
  )
}
