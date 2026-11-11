
export default function StatCard({
  title,
  value,
  description,
  icon: Icon
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{title}</p>

        {Icon && (
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl">
            <Icon size={22} />
          </div>
        )}
      </div>

      <h3 className="text-3xl font-bold text-slate-800 mt-4">
        {value}
      </h3>

      <p className="text-xs text-slate-400 mt-2">
        {description}
      </p>
    </div>
  )
}
