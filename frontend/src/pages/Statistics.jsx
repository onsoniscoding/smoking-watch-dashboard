
import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
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
      setError('Cannot load statistics.')
    }
  }

  useEffect(() => {
    loadStatistics()

    const timer = setInterval(loadStatistics, 10000)
    return () => clearInterval(timer)
  }, [])

  const cameraData = Object.entries(
    stats?.camera_counts || {}
  ).map(([camera, count]) => ({
    camera,
    count
  }))

  const eventData = Object.entries(
    stats?.event_type_counts || {}
  ).map(([type, count]) => ({
    type,
    count
  }))

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          Statistics
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Overview of recorded detection data.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border p-6">
          <p className="text-sm text-slate-500">
            Total Detections
          </p>
          <p className="text-4xl font-bold mt-3">
            {stats?.total_detections ?? 0}
          </p>
        </div>

        <div className="bg-white rounded-2xl border p-6">
          <p className="text-sm text-slate-500">
            Today's Detections
          </p>
          <p className="text-4xl font-bold mt-3">
            {stats?.today_detections ?? 0}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border p-6">
          <h3 className="font-semibold mb-6">
            Detections by Camera
          </h3>

          {cameraData.length === 0 ? (
            <p className="text-sm text-slate-400">
              No camera data available
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={cameraData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="camera" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-2xl border p-6">
          <h3 className="font-semibold mb-6">
            Detections by Event Type
          </h3>

          {eventData.length === 0 ? (
            <p className="text-sm text-slate-400">
              No event type data available
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={eventData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#0f766e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
