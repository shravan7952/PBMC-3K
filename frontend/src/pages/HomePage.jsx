// pages/HomePage.jsx – TCGA-portal style summary dashboard
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
         Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { api } from '../api.js'
import { useStore } from '../store.js'

// Cell type colors matching the sidebar legend
const CT_COLORS = {
  'CD4+ T cells':       '#60a5fa',
  'T cells':            '#60a5fa',
  'CD8+ T cells':       '#34d399',
  'NK / CD8+ T cells':  '#10b981',
  'NK cells':           '#10b981',
  'B cells':            '#8b5cf6',
  'Monocytes (CD14+)':  '#f97316',
  'Monocytes (FCGR3A+)':'#fb923c',
  'Monocytes':          '#f97316',
  'Dendritic cells':    '#ec4899',
  'Megakaryocytes':     '#f59e0b',
  'Unknown':            '#64748b',
}

const KNOWN_MARKERS = {
  'CD4+ T cells':       ['IL7R', 'CCR7', 'LDHB', 'RPS12'],
  'B cells':            ['MS4A1', 'CD79A', 'CD79B'],
  'Monocytes (CD14+)':  ['LYZ', 'CST3', 'CD14', 'FCGR3A'],
  'NK / CD8+ T cells':  ['NKG7', 'GZMA', 'GNLY', 'CST7'],
  'Dendritic cells':    ['FCER1A', 'HLA-DRA', 'HLA-DPA1'],
  'Megakaryocytes':     ['PF4', 'PPBP', 'SDPR'],
}

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="portal-card px-3 py-2 text-xs space-y-1 shadow-portal">
      <p className="font-semibold text-white">{d.name}</p>
      <p className="text-slate-400">Cells: <span className="text-white font-mono">{d.n_cells?.toLocaleString()}</span></p>
      <p className="text-slate-400">Share: <span className="text-blue-300 font-mono">{d.pct?.toFixed(1)}%</span></p>
      <p className="text-slate-500 text-[10px]">Cluster {d.cluster}</p>
    </div>
  )
}

const BarTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="portal-card px-3 py-2 text-xs shadow-portal">
      <p className="font-semibold text-white">{d.annotation}</p>
      <p className="text-slate-400">Cluster <span className="font-mono">{d.cluster}</span></p>
      <p className="text-slate-400">{d.n_cells?.toLocaleString()} cells <span className="text-blue-300">({d.pct?.toFixed(1)}%)</span></p>
    </div>
  )
}

function SummaryBanner({ stats }) {
  const items = [
    { value: stats?.total_cells?.toLocaleString() ?? '—', label: 'Cells', icon: '🧫' },
    { value: stats?.total_genes?.toLocaleString() ?? '—', label: 'Genes', icon: '🧬' },
    { value: stats?.n_clusters ?? '—', label: 'Clusters', icon: '◉' },
    { value: stats ? Math.round(stats.median_genes).toLocaleString() : '—', label: 'Median Genes/Cell', icon: '📊' },
    { value: stats ? Math.round(stats.median_umi).toLocaleString() : '—', label: 'Median UMIs/Cell', icon: '🔢' },
    { value: stats ? `${stats.median_pct_mt.toFixed(1)}%` : '—', label: 'Median %MT', icon: '⚡' },
  ]
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(it => (
        <div key={it.label} className="stat-pill">
          <span className="text-base">{it.icon}</span>
          <div>
            <p className="text-xs font-bold text-white font-mono">{it.value}</p>
            <p className="text-[9px] text-slate-500 leading-none">{it.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function HomePage() {
  const [qc,         setQc]         = useState(null)
  const [clusters,   setClusters]   = useState([])
  const [search,     setSearch]     = useState('')
  const navigate = useNavigate()
  const sendChatQuery = useStore(s => s.sendChatQuery)

  useEffect(() => {
    api.qcMetrics().then(setQc).catch(console.error)
    api.clusterSummary().then(r => setClusters(r.clusters)).catch(console.error)
    api.annotations().then(a => useStore.getState().setAnnotations(a)).catch(console.error)
  }, [])

  const annotations = useStore(s => s.annotations)

  const handleSearch = (e) => {
    e.preventDefault()
    if (!search.trim()) return
    sendChatQuery(search.trim())
    navigate('/chat')
  }

  const pieData = clusters.map(c => ({
    name: annotations[c.cluster] || c.annotation,
    n_cells: c.n_cells,
    pct: c.pct,
    cluster: c.cluster,
  }))

  return (
    <div className="page-scroll">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* Portal header */}
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="" className="h-8 w-8 object-contain opacity-80"
              style={{ filter: 'brightness(0) invert(1)' }} />
            <div>
              <h1 className="text-xl font-bold text-white">PBMC 3K Data Portal</h1>
              <p className="text-xs text-slate-500">
                Peripheral Blood Mononuclear Cells · 10x Genomics · Human (hg19) · Leiden clustering
              </p>
            </div>
          </div>
        </div>

        {/* Search bar - TCGA style primary search */}
        <div className="portal-card p-4">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search genes, cell types, or ask a question… e.g. Plot CD3D, Show UMAP, Top markers cluster 0"
                className="search-input pl-10 pr-4"
              />
            </div>
            <button type="submit" className="portal-btn shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
              Explore
            </button>
          </form>
          {/* Quick searches */}
          <div className="flex flex-wrap gap-2 mt-3">
            {['Show UMAP', 'Plot CD3D', 'Plot MS4A1', 'Top markers cluster 0', 'Plot NKG7', 'List clusters'].map(q => (
              <button key={q} onClick={() => { sendChatQuery(q); navigate('/chat') }}
                className="filter-tag">
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Summary bar */}
        <SummaryBanner stats={qc?.stats} />

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Cell composition - TCGA portal style table */}
          <div className="lg:col-span-2 portal-card overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="section-title">Cell Type Composition</h2>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Leiden clusters annotated with known PBMC marker genes
                </p>
              </div>
              <button onClick={() => navigate('/clusters')} className="portal-btn-ghost">
                Full analysis →
              </button>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Cluster</th>
                  <th>Cell Type</th>
                  <th>Cells</th>
                  <th>%</th>
                  <th>Key Markers</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {clusters.map((c, i) => {
                  const name = annotations[c.cluster] || c.annotation
                  const color = CT_COLORS[name] || c.color || '#64748b'
                  const markers = KNOWN_MARKERS[name] || c.top_genes.slice(0, 3)
                  return (
                    <tr key={c.cluster} className="cursor-pointer"
                      onClick={() => navigate('/clusters')}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                          <span className="font-mono font-semibold text-slate-200">C{c.cluster}</span>
                        </div>
                      </td>
                      <td>
                        <span className="cell-badge border"
                          style={{ borderColor: color + '40', background: color + '15', color }}>
                          {name}
                        </span>
                      </td>
                      <td className="font-mono text-slate-300">{c.n_cells.toLocaleString()}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 rounded-full bg-slate-700 w-16">
                            <div className="h-1.5 rounded-full" style={{ width: `${c.pct}%`, background: color }} />
                          </div>
                          <span className="text-slate-400 font-mono text-[10px]">{c.pct.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {markers.slice(0, 3).map(g => (
                            <span key={g} className="px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 font-mono text-[9px]">
                              {g}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="text-slate-500 text-[10px] max-w-[200px]">{c.description}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pie chart */}
          <div className="portal-card flex flex-col">
            <div className="px-5 py-3 border-b border-slate-800">
              <h2 className="section-title">Distribution</h2>
              <p className="text-[10px] text-slate-500 mt-0.5">Cell type proportions</p>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-4">
              {clusters.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={pieData} dataKey="n_cells" cx="50%" cy="50%"
                        innerRadius={55} outerRadius={90} paddingAngle={2} stroke="none">
                        {pieData.map((d, i) => (
                          <Cell key={i} fill={CT_COLORS[d.name] || '#64748b'} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Legend */}
                  <div className="space-y-1.5 w-full">
                    {pieData.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 text-[10px]">
                        <span className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: CT_COLORS[d.name] || '#64748b' }} />
                        <span className="text-slate-400 flex-1 truncate">{d.name}</span>
                        <span className="text-slate-500 font-mono">{d.pct?.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-slate-600 text-sm">Loading…</div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom navigation cards - TCGA "Explore" tiles */}
        <div>
          <h2 className="section-title mb-3">Explore Data</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                icon: '◎', label: 'UMAP Explorer',
                sub: 'Interactive 2D embedding · Pan, zoom · Color by gene or cluster',
                to: '/umap', color: '#2563eb',
              },
              {
                icon: '⌬', label: 'Gene Expression',
                sub: 'Violin plots · Dot plots · Gene autocomplete search',
                to: '/genes', color: '#059669',
              },
              {
                icon: '◉', label: 'Cluster Analysis',
                sub: 'Marker genes · DEG comparison · Cell type annotation',
                to: '/clusters', color: '#7c3aed',
              },
              {
                icon: '◈', label: 'Quality Control',
                sub: 'UMI/gene scatter · MT% distribution · Pre-filter stats',
                to: '/qc', color: '#d97706',
              },
            ].map(({ icon, label, sub, to, color }) => (
              <button key={to} onClick={() => navigate(to)}
                className="portal-card p-4 text-left hover:border-slate-600 transition-all group active:scale-[0.99]">
                <div className="text-2xl mb-2 font-mono" style={{ color }}>{icon}</div>
                <p className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">{label}</p>
                <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{sub}</p>
                <p className="text-[10px] mt-2 font-medium transition-colors" style={{ color }}>
                  Explore →
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Bottom info row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4">
          {/* About PBMC 3K */}
          <div className="portal-card p-4">
            <h3 className="text-xs font-semibold text-slate-300 mb-2">About PBMC 3K Dataset</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Peripheral Blood Mononuclear Cells (PBMCs) from a healthy donor. Sequenced on the
              10x Genomics Chromium platform. This canonical dataset has been pre-processed
              with Scanpy: filtered (min 200 genes, max 5% MT), normalized, log-transformed,
              HVG selection, PCA → UMAP → Leiden clustering.
            </p>
            <div className="mt-3 flex gap-2 flex-wrap">
              {[['Reference', '10x Genomics'], ['Tissue', 'Blood (PBMC)'], ['Species', 'Homo sapiens'], ['Genome', 'hg19']].map(([k, v]) => (
                <span key={k} className="px-2 py-0.5 rounded bg-slate-800 text-[10px]">
                  <span className="text-slate-500">{k}: </span>
                  <span className="text-slate-300">{v}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Pipeline */}
          <div className="portal-card p-4">
            <h3 className="text-xs font-semibold text-slate-300 mb-2">Processing Pipeline</h3>
            <div className="space-y-1.5">
              {[
                ['1. Load', 'sc.read_10x_mtx → filtered_gene_bc_matrices/hg19'],
                ['2. Filter', 'min_genes=200, max_pct_mt=5%, min_cells=3'],
                ['3. Normalize', 'normalize_total(10,000) → log1p'],
                ['4. HVG', 'highly_variable_genes (0.0125–3 mean, 0.5 disp)'],
                ['5. PCA', 'svd_solver=arpack, 40 PCs'],
                ['6. Graph', 'neighbors(n_neighbors=10, n_pcs=40)'],
                ['7. Cluster', 'Leiden (resolution=0.5)'],
                ['8. UMAP', 'tl.umap → obsm["X_umap"]'],
              ].map(([step, desc]) => (
                <div key={step} className="flex gap-2 text-[10px]">
                  <span className="text-blue-400 font-mono font-semibold shrink-0 w-14">{step}</span>
                  <span className="text-slate-500 font-mono">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
