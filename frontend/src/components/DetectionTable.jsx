
import { Eye } from 'lucide-react'

export default function DetectionTable({
  detections = [],
  onSelect
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="p-5 border-b border-slate-100">
        <h3 className="font-semibold text-slate-800">
          Recent Detection Events
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Latest recorded events
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="p-4">Event ID</th>
              <th className="p-4">Date & Time</th>
              <th className="p-4">Camera</th>
              <th className="p-4">Confidence</th>
              <th className="p-4">Type</th>
              <th className="p-4">Action</th>
            </tr>
          </thead>

          <tbody>
            {detections.length === 0 ? (
              <tr>
                <td colSpan="6" className="p-8 text-center text-slate-400">
                  No detection events found
                </td>
              </tr>
            ) : (
              detections.map((item) => (
                <tr key={item.event_id} className="border-t border-slate-100">
                  <td className="p-4 font-medium text-slate-700">
                    {item.event_id}
                  </td>

                  <td className="p-4 text-slate-500">
                    {new Date(item.timestamp).toLocaleString('th-TH')}
                  </td>

                  <td className="p-4">{item.camera_name}</td>

                  <td className="p-4">
                    {(item.confidence * 100).toFixed(1)}%
                  </td>

                  <td className="p-4">
                    <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded-lg">
                      {item.event_type}
                    </span>
                  </td>

                  <td className="p-4">
                    <button
                      onClick={() => onSelect?.(item)}
                      className="text-emerald-600 hover:text-emerald-800"
                      aria-label={`View ${item.event_id}`}
                    >
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
