// Sidebar.jsx – TCGA-portal style filter + query sidebar
export default function Sidebar({ onQuery }) {
  const quickQueries = [
    { label: 'Show UMAP',            query: 'Show UMAP' },
    { label: 'Plot CD3D',            query: 'Plot CD3D' },
    { label: 'Plot MS4A1 (B cells)', query: 'Plot MS4A1' },
    { label: 'Plot NKG7 (NK cells)', query: 'Plot NKG7' },
    { label: 'Markers cluster 0',    query: 'Top markers cluster 0' },
    { label: 'Markers cluster 2',    query: 'Top markers cluster 2' },
    { label: 'List clusters',        query: 'List clusters' },
  ]

  const cellTypes = [
    { name: 'CD4+ T cells',    color: '#60a5fa', cluster: '0', pct: '44.6%' },
    { name: 'B cells',         color: '#8b5cf6', cluster: '1', pct: '12.9%' },
    { name: 'Monocytes',       color: '#f97316', cluster: '2', pct: '24.1%' },
    { name: 'NK / CD8+ T',     color: '#10b981', cluster: '3', pct: '16.5%' },
    { name: 'Dendritic cells', color: '#ec4899', cluster: '4', pct: '1.4%' },
    { name: 'Megakaryocytes',  color: '#f59e0b', cluster: '5', pct: '0.5%' },
  ]

  return (
    <aside className="w-56 flex flex-col border-r border-slate-800 bg-portal-900 overflow-y-auto">
      {/* Logo block */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="CodeCell.ai"
            className="h-7 w-7 object-contain"
            style={{ filter: 'invert(1)', mixBlendMode: 'screen' }} />
          <div>
            <p className="text-xs font-bold text-white">CodeCell<span className="text-blue-400">.ai</span></p>
            <p className="text-[9px] text-slate-600 font-mono">scRNA Explorer</p>
          </div>
        </div>
      </div>

      {/* Dataset info */}
      <div className="px-4 py-3 border-b border-slate-800">
        <p className="text-[9px] text-slate-600 uppercase tracking-widest font-semibold mb-2">Dataset</p>
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Project</span>
            <span className="text-slate-300 font-medium">PBMC 3K</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Source</span>
            <span className="text-slate-400">10x Genomics</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Genome</span>
            <span className="text-blue-400 font-mono">hg19</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] text-emerald-400">Loaded & processed</span>
          </div>
        </div>
      </div>

      {/* Cell type legend */}
      <div className="px-4 py-3 border-b border-slate-800">
        <p className="text-[9px] text-slate-600 uppercase tracking-widest font-semibold mb-2">Cell Types</p>
        <div className="space-y-1.5">
          {cellTypes.map(ct => (
            <div key={ct.cluster} className="flex items-center gap-2 text-[11px]">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ct.color }} />
              <span className="text-slate-400 flex-1">{ct.name}</span>
              <span className="text-slate-600 font-mono text-[10px]">{ct.pct}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick queries */}
      <div className="px-4 py-3 flex-1">
        <p className="text-[9px] text-slate-600 uppercase tracking-widest font-semibold mb-2">Quick Queries</p>
        <div className="space-y-1">
          {quickQueries.map(({ label, query }) => (
            <button key={query} onClick={() => onQuery(query)}
              className="query-chip">
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-800">
        <p className="text-[9px] text-slate-600">FastAPI · Scanpy · React · Plotly</p>
        <p className="text-[9px] text-slate-700 mt-0.5">© 2026 CodeCell.ai</p>
      </div>
    </aside>
  )
}
