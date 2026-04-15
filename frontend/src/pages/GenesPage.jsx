// pages/GenesPage.jsx – Gene expression with split panel: gene card + violin/UMAP/dotplot
import { useState, useEffect } from 'react'
import GeneSearch from '../components/GeneSearch.jsx'
import ViolinPlot from '../components/ViolinPlot.jsx'
import DotPlot from '../components/DotPlot.jsx'
import InteractiveUMAP from '../components/InteractiveUMAP.jsx'
import { api } from '../api.js'

const MARKER_GENES = [
  { gene: 'CD3D',  type: 'T cells (CD4+)',     color: '#60a5fa' },
  { gene: 'CD3E',  type: 'T cells',             color: '#60a5fa' },
  { gene: 'MS4A1', type: 'B cells',             color: '#8b5cf6' },
  { gene: 'CD79A', type: 'B cells',             color: '#8b5cf6' },
  { gene: 'LYZ',   type: 'Monocytes',           color: '#f97316' },
  { gene: 'CST3',  type: 'Monocytes',           color: '#f97316' },
  { gene: 'GNLY',  type: 'NK / CD8+ T',         color: '#10b981' },
  { gene: 'NKG7',  type: 'NK / CD8+ T',         color: '#10b981' },
  { gene: 'CD8A',  type: 'CD8+ T cells',        color: '#34d399' },
  { gene: 'PPBP',  type: 'Megakaryocytes',      color: '#f59e0b' },
  { gene: 'FCER1A',type: 'Dendritic cells',     color: '#ec4899' },
  { gene: 'HLA-DRA',type:'Antigen-presenting',  color: '#a78bfa' },
]

const DEFAULT_DOTPLOT_GENES = ['CD3D','MS4A1','LYZ','CD79A','GNLY','NKG7','CD8A','PPBP','FCER1A']

function GeneInfoCard({ gene, violinData }) {
  if (!gene) return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3">
      <div className="text-4xl opacity-20">🧬</div>
      <p className="text-sm font-medium text-slate-500">Select a gene to explore its expression</p>
      <p className="text-[10px] text-slate-600">Use the search box or click a marker gene chip</p>
    </div>
  )

  // Compute cross-cluster stats from violin data
  const clusterStats = violinData
    ? Object.entries(violinData.per_cluster).map(([clus, d]) => ({
        cluster: clus, ...d
      })).sort((a, b) => b.pct_expressing - a.pct_expressing)
    : []

  const topCluster = clusterStats[0]
  const overallMean = clusterStats.length
    ? (clusterStats.reduce((s, d) => s + d.mean, 0) / clusterStats.length).toFixed(3)
    : '—'

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
      {/* Gene title */}
      <div className="portal-card p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-900/30 border border-blue-700/30 flex items-center justify-center text-lg shrink-0">
            🧬
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-blue-300 font-mono">{gene}</h2>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {MARKER_GENES.find(m => m.gene === gene)?.type || 'Gene expression across clusters'}
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {clusterStats.length > 0 && (
        <div className="portal-card p-4 space-y-3">
          <p className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold">Expression Summary</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Mean Expr', value: overallMean, color: 'text-blue-300' },
              { label: 'Top Cluster', value: `C${topCluster?.cluster}`, color: 'text-emerald-400' },
            ].map(s => (
              <div key={s.label} className="bg-slate-800/60 rounded-lg p-2.5 text-center">
                <p className={`text-sm font-bold font-mono ${s.color}`}>{s.value}</p>
                <p className="text-[9px] text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Per-cluster % expressing bars */}
          <div className="space-y-1.5 mt-1">
            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold">% Expressing per Cluster</p>
            {clusterStats.sort((a,b) => parseInt(a.cluster)-parseInt(b.cluster)).map(d => (
              <div key={d.cluster} className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-slate-500 w-4">C{d.cluster}</span>
                <div className="flex-1 h-4 bg-slate-800 rounded overflow-hidden">
                  <div
                    className="h-full rounded transition-all"
                    style={{
                      width: `${d.pct_expressing}%`,
                      background: `linear-gradient(90deg, #3b82f6, #8b5cf6)`,
                    }}
                  />
                </div>
                <span className="text-[9px] font-mono text-slate-400 w-8 text-right">
                  {d.pct_expressing.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Marker gene cross-ref */}
      {MARKER_GENES.find(m => m.gene === gene) && (
        <div className="portal-card p-3">
          <p className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold mb-2">Cell Type Marker</p>
          <div className="flex items-center gap-2">
            <span className="cell-badge border"
              style={{
                borderColor: (MARKER_GENES.find(m => m.gene === gene)?.color || '#64748b') + '40',
                background:  (MARKER_GENES.find(m => m.gene === gene)?.color || '#64748b') + '15',
                color:        MARKER_GENES.find(m => m.gene === gene)?.color || '#64748b',
              }}>
              {MARKER_GENES.find(m => m.gene === gene)?.type}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
            Known canonical marker gene used to identify cell types in PBMC datasets.
          </p>
        </div>
      )}
    </div>
  )
}

export default function GenesPage() {
  const [selectedGene, setSelectedGene] = useState(null)
  const [activeTab,    setActiveTab]    = useState('violin')
  const [violinData,   setViolinData]   = useState(null)

  useEffect(() => {
    if (!selectedGene) { setViolinData(null); return }
    api.violin(selectedGene).then(setViolinData).catch(() => setViolinData(null))
  }, [selectedGene])

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* Left panel: gene info card */}
      <div style={{
        width: '240px', flexShrink: 0,
        borderRight: '1px solid #1e293b',
        background: '#070b14',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Gene search */}
        <div style={{ padding: '12px', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
          <p className="text-[9px] text-slate-600 uppercase tracking-widest font-semibold mb-2">Search Gene</p>
          <GeneSearch
            onSelect={setSelectedGene}
            placeholder="e.g. CD3D, MS4A1…"
          />
        </div>

        {/* Quick marker chips */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
          <p className="text-[9px] text-slate-600 uppercase tracking-widest font-semibold mb-2">Canonical Markers</p>
          <div className="flex flex-wrap gap-1">
            {MARKER_GENES.map(({ gene, color }) => (
              <button key={gene}
                onClick={() => setSelectedGene(gene)}
                style={{
                  padding: '2px 7px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                  fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
                  border: `1px solid ${selectedGene === gene ? color : color + '30'}`,
                  background: selectedGene === gene ? color + '20' : 'transparent',
                  color: selectedGene === gene ? color : color + 'bb',
                  transition: 'all 0.15s',
                }}
              >
                {gene}
              </button>
            ))}
          </div>
        </div>

        {/* Gene info card */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <GeneInfoCard gene={selectedGene} violinData={violinData} />
        </div>
      </div>

      {/* Right panel: tabs + visualization */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Sub-tab bar */}
        <div style={{
          display: 'flex', gap: 4, padding: '8px 16px',
          borderBottom: '1px solid #1e293b', flexShrink: 0,
          background: '#0a1020', alignItems: 'center',
        }}>
          {[
            { id: 'violin',  label: '🎻 Per-Cluster Violin' },
            { id: 'umap',    label: '◎ UMAP Overlay' },
            { id: 'dotplot', label: '⚫ Dot Plot' },
          ].map(tab => (
            <button key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '5px 14px', borderRadius: 8, fontSize: 11, fontWeight: 500,
                cursor: 'pointer', transition: 'all 0.15s',
                background: activeTab === tab.id ? '#2563eb' : 'transparent',
                color: activeTab === tab.id ? '#fff' : '#64748b',
                border: activeTab === tab.id ? 'none' : '1px solid transparent',
              }}
            >
              {tab.label}
            </button>
          ))}
          {selectedGene && (
            <span style={{
              marginLeft: 'auto', fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
              color: '#93c5fd', padding: '4px 10px', background: '#1e3a8a30',
              border: '1px solid #3b82f640', borderRadius: 8,
            }}>
              {selectedGene}
            </span>
          )}
        </div>

        {/* Content area */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '20px' }}>
          {activeTab === 'violin' && (
            <div>
              {selectedGene
                ? <ViolinPlot gene={selectedGene} />
                : (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-600 gap-2">
                    <span className="text-3xl">🎻</span>
                    <p className="text-sm">Select a gene to see its expression distribution</p>
                  </div>
                )
              }
            </div>
          )}

          {activeTab === 'umap' && (
            <div>
              <p className="text-[10px] text-slate-500 mb-3">
                {selectedGene
                  ? <>UMAP colored by <span className="text-blue-300 font-mono font-semibold">{selectedGene}</span> expression (Magma scale — bright = high)</>
                  : 'Select a gene to overlay its expression on the UMAP embedding'
                }
              </p>
              <InteractiveUMAP colorBy={selectedGene || 'leiden'} height={480} />
            </div>
          )}

          {activeTab === 'dotplot' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">Multi-Gene Dot Plot</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">Dot size = % cells expressing · Color intensity = mean expression</p>
                </div>
              </div>
              <DotPlot genes={DEFAULT_DOTPLOT_GENES} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
