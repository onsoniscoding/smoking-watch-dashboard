
import { useEffect, useMemo, useState } from 'react'
import { Search, RefreshCw } from 'lucide-react'

import { fetchDetections } from '../services/detectionService'

export default function DetectionLogs() {
  const [detections, setDetections] = useState([])
  const [search, setSearch] = useState('')
  const [camera, setCamera] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadData() {
    try {
      const result = await fetchDetections({ limit: 500 })
      setDetections(result.data || [])
      setError('')
    } catch (err) {
      console.error(err)
      setError('Cannot load detection logs.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    const timer = setInterval(loadData, 5000)
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

      return matchesSearch && matchesCamera
    })
  }, [detections, search, camera])

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          Detection Logs
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Search and review recorded detection events.
        </p>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-3 text-slate-400"
            size={18}
          />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search Event ID or Camera..."
            className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-emerald-300"
          />
        </div>

        <select
          value={camera}
          onChange={(event) => setCamera(event.target.value)}
          className="border border-slate-200 rounded-xl px-4 py-3 bg-white"
        >
          <option value="all">All Cameras</option>
          {cameras.map((id) => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>

        <button
          onClick={loadData}
          className="flex items-center justify-center gap-2 border rounded-xl px-4 py-3 hover:bg-slate-50"
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl">
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-5 border-b flex justify-between">
          <h3 className="font-semibold">All Events</h3>
          <span className="text-sm text-slate-500">
            {filtered.length} records
          </span>
        </div>

        {loading ? (
          <p className="p-6 text-slate-500">Loading...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-4">Event ID</th>
                  <th className="p-4">Date & Time</th>
                  <th className="p-4">Camera</th>
                  <th className="p-4">Event Type</th>
                  <th className="p-4">Confidence</th>
                  <th className="p-4">Gate</th>
                  <th className="p-4">Face Blur</th>
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-slate-400">
                      No records found
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr key={item.event_id} className="border-t">
                      <td className="p-4 font-medium">
                        {item.event_id}
                      </td>

                      <td className="p-4 text-slate-500">
                        {new Date(item.timestamp).toLocaleString('th-TH')}
                      </td>

                      <td className="p-4">{item.camera_name}</td>

                      <td className="p-4">{item.event_type}</td>

                      <td className="p-4">
                        {(item.confidence * 100).toFixed(1)}%
                      </td>

                      <td className="p-4">
                        {item.smoke_mandatory_gate ? 'Passed' : 'Not passed'}
                      </td>

                      <td className="p-4">
                        {item.face_blurred ? 'Flag: true' : 'Flag: false'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
