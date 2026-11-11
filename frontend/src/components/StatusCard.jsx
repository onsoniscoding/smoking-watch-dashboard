
export default function StatusCard({ status }) {
  const online = status?.status === 'online'

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-slate-800">
          System Status
        </h3>

        <span
          className={`text-xs px-3 py-1 rounded-full ${
            online
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {online ? 'ONLINE' : 'OFFLINE'}
        </span>
      </div>

      <p className="text-sm text-slate-500 mt-3">
        Jetson / Edge Device
      </p>

      <p className="text-xs text-slate-400 mt-2">
        Last heartbeat:{' '}
        {status?.last_heartbeat
          ? new Date(status.last_heartbeat).toLocaleString('th-TH')
          : 'No heartbeat received'}
      </p>
    </div>
  )
}
