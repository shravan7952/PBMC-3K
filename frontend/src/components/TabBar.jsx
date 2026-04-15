// TabBar.jsx – TCGA-portal style top navigation
import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/',         icon: '⬡', label: 'Summary' },
  { to: '/umap',     icon: '◎', label: 'UMAP Explorer' },
  { to: '/genes',    icon: '⌬', label: 'Gene Expression' },
  { to: '/clusters', icon: '◉', label: 'Clusters' },
  { to: '/qc',       icon: '◈', label: 'Quality Control' },
  { to: '/chat',     icon: '⊹', label: 'AI Assistant' },
]

export default function TabBar() {
  return (
    <nav className="flex items-center gap-0.5 px-2 h-10 flex-1 overflow-x-auto">
      {TABS.map(({ to, icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg transition-all whitespace-nowrap
             ${isActive
               ? 'bg-blue-600/20 text-blue-300 border border-blue-600/40'
               : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
             }`
          }
        >
          <span className="font-mono text-[10px] opacity-60">{icon}</span>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
