import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Video,
  History,
  ChartNoAxesCombined,
  ShieldCheck,
  Activity
} from 'lucide-react'

const menus = [
  {
    label: 'ภาพรวมระบบ',
    path: '/',
    icon: LayoutDashboard
  },
  {
    label: 'กล้องเว็บแคมสด',
    path: '/webcam',
    icon: Video
  },
  {
    label: 'ประวัติการตรวจจับ',
    path: '/logs',
    icon: History
  },
  {
    label: 'สถิติและกราฟ',
    path: '/statistics',
    icon: ChartNoAxesCombined
  }
]

export default function Sidebar() {
  return (
    <aside className="w-64 min-h-screen bg-slate-950 text-white flex flex-col">
      <div className="p-5 border-b border-slate-800 space-y-3.5">
        <div className="bg-white rounded-xl px-3.5 py-2.5 flex items-center justify-center shadow-sm">
          <img
            src="/spu-logo.png"
            alt="Sripatum University (SPU)"
            className="h-10 w-auto object-contain"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 p-2 rounded-xl shrink-0">
            <ShieldCheck size={22} />
          </div>

          <div>
            <h1 className="text-lg font-bold leading-tight">Smoke Watch</h1>
            <p className="text-xs text-slate-400">
              ระบบตรวจจับการสูบบุหรี่อัจฉริยะ
            </p>
          </div>
        </div>
      </div>

      <nav className="p-4 flex-1 space-y-2">
        <p className="text-xs text-slate-500 uppercase px-3 py-2">
          เมนูหลัก
        </p>

        {menus.map((menu) => {
          const Icon = menu.icon

          return (
            <NavLink
              key={menu.path}
              to={menu.path}
              end={menu.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                  isActive
                    ? 'bg-emerald-500 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon size={20} />
              <span>{menu.label}</span>
            </NavLink>
          )
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-2 text-emerald-400">
          <Activity size={17} />
          <span className="text-sm">ระบบเฝ้าระวังพื้นที่ปลอดบุหรี่</span>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          เชื่อมต่อกับ CiRA CORE AI
        </p>
      </div>
    </aside>
  )
}
