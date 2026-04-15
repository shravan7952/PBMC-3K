// KPICard.jsx – Metric card for the home dashboard
export default function KPICard({ icon, label, value, sub, accent = false }) {
  return (
    <div className={`glass-card p-4 flex items-start gap-3 hover:border-brand-500/30 transition-colors
      ${accent ? 'border-brand-500/30 bg-brand-900/20' : ''}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0
        ${accent ? 'bg-brand-600/30' : 'bg-surface-500'}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">{label}</p>
        <p className={`text-xl font-bold leading-tight mt-0.5 ${accent ? 'text-brand-300' : 'text-white'}`}>
          {value}
        </p>
        {sub && <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}
