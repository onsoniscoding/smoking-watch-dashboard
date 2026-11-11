
import { useEffect, useState } from 'react'
import {
  Activity,
  Camera,
  ShieldAlert,
  CalendarDays,
  RefreshCw
} from 'lucide-react'

import StatCard from '../components/StatCard'
import StatusCard from '../components/StatusCard'
import DetectionTable from '../components/DetectionTable'

import {
  fetchDetections
} from '../services/detectionService'

import {
  fetchStatistics,
  fetchSystemStatus
} from '../services/statisticsService'

export default function Dashboard() {
  const [detections, setDetections] = useState([])
  const [statistics, setStatistics] = useState(null)
  const [system, setSystem] = useState(null)
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadDashboard() {
    try {
      const [eventResult, statsResult, systemResult] =
        await Promise.all([
          fetchDetections({ limit: 100 }),
          fetchStatistics(),
          fetchSystemStatus()
        ])

      setDetections(eventResult.data || [])
      setStatistics(statsResult.data)
      setSystem(systemResult.data)
      setError('')
    } catch (err) {
      console.error(err)
      setError('Cannot connect to Backend. Please check the server.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()

    const timer = setInterval(loadDashboard, 5000)

    return () => clearInterval(timer)
  }, [])

  if (loading) {
    return (
      <div className="p-8 text-slate-500">
        Loading Dashboard...
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Overview
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor smoking detection events and system activity.
          </p>
        </div>

        <button
          onClick={loadDashboard}
          className="flex items-center gap-2 px-4 py-2 bg-white border rounded-xl text-sm hover:bg-slate-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl">
          {error}
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-sm">
        Prototype Dashboard — displayed events are from the connected test database.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard
          title="Total Detections"
          value={statistics?.total_detections ?? 0}
          description="All recorded events"
          icon={Activity}
        />

        <StatCard
          title="Today's Detections"
          value={statistics?.today_detections ?? 0}
          description="Events recorded today"
          icon={CalendarDays}
        />

        <StatCard
          title="Active Cameras"
          value={Object.keys(statistics?.camera_counts || {}).length}
          description="Cameras with recorded events"
          icon={Camera}
        />

        <StatCard
          title="Gate Passed"
          value={detections.filter(
            (item) => item.smoke_mandatory_gate === true
          ).length}
          description="Events marked as gate passed"
          icon={ShieldAlert}
        />
      </div>

      <StatusCard status={system} />

      <DetectionTable
        detections={detections.slice(0, 5)}
        onSelect={setSelected}
      />

      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-lg">
                Detection Details
              </h3>

              <button
                onClick={() => setSelected(null)}
                className="text-slate-500 hover:text-slate-900"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <p><strong>Event ID:</strong> {selected.event_id}</p>
              <p><strong>Camera:</strong> {selected.camera_name}</p>
              <p><strong>Type:</strong> {selected.event_type}</p>
              <p><strong>Confidence:</strong> {(selected.confidence * 100).toFixed(1)}%</p>
              <p><strong>Face blur flag:</strong> {String(selected.face_blurred)}</p>
              <p><strong>Evidence review:</strong> {selected.evidence_review_required ? 'Required' : 'No evidence URL received'}</p>
              <p><strong>Evidence URL:</strong> Not available in this prototype</p>
            </div>

            <button
              onClick={() => setSelected(null)}
              className="mt-6 w-full bg-emerald-600 text-white py-3 rounded-xl"
            >
              Close Details
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
