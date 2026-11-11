
import {
  BrowserRouter,
  Routes,
  Route,
  Outlet
} from 'react-router-dom'

import Sidebar from './components/Sidebar'
import Header from './components/Header'

import Dashboard from './pages/Dashboard'
import DetectionLogs from './pages/DetectionLogs'
import Statistics from './pages/Statistics'

function MainLayout() {
  return (
    <div className="min-h-screen bg-slate-100 flex">
      <Sidebar />

      <div className="flex-1 min-w-0">
        <Header />

        <main>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/logs" element={<DetectionLogs />} />
          <Route path="/statistics" element={<Statistics />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
