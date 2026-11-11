
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  History,
  ChartNoAxesCombined,
  ShieldCheck,
  Activity
} from 'lucide-react'

const menus = [
  {
    label: 'Dashboard',
    path: '/',
    icon: LayoutDashboard
  },
  {
    label: 'Detection Logs',
    path: '/logs',
    icon: History
  },
  {
    label: 'Statistics',
    path: '/statistics',
    icon: ChartNoAxesCombined
  }
]

export default function Sidebar() {
  return (
    <aside className="w-64 min-h-screen bg-slate-950 text-white flex flex-col">
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 p-2 rounded-xl">
            <ShieldCheck size={25} />
          </div>

          <div>
            <h1 className="text-xl font-bold">Smoke Watch</h1>
            <p className="text-xs text-slate-400">
              Smart Detection System
            </p>
          </div>
        </div>
      </div>

      <nav className="p-4 flex-1 space-y-2">
        <p className="text-xs text-slate-500 uppercase px-3 py-2">
          Main Menu
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
          <span className="text-sm">Smoke Watch Dashboard</span>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Project Prototype
        </p>
      </div>
    </aside>
  )
}
