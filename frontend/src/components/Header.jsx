
import { useLocation } from 'react-router-dom'
import { Bell, ShieldCheck } from 'lucide-react'

const titles = {
  '/': 'Dashboard Overview',
  '/logs': 'Detection Logs',
  '/statistics': 'Statistics'
}

export default function Header() {
  const location = useLocation()
  const title = titles[location.pathname] || 'Smoke Watch'

  return (
    <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between">
      <div>
        <h2 className="text-xl font-bold text-slate-800">
          {title}
        </h2>
        <p className="text-sm text-slate-500">
          Smoking Detection Monitoring System
        </p>
      </div>

      <div className="flex items-center gap-5">
        <span className="text-xs bg-amber-50 text-amber-700 px-3 py-2 rounded-full">
          Prototype
        </span>

        <Bell className="text-slate-500" size={20} />

        <div className="flex items-center gap-2">
          <div className="bg-emerald-100 p-2 rounded-full">
            <ShieldCheck className="text-emerald-700" size={20} />
          </div>
          <span className="text-sm font-medium text-slate-700">
            Administrator
          </span>
        </div>
      </div>
    </header>
  )
}
