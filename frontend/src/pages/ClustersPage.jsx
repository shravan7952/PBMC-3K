// pages/ClustersPage.jsx – TCGA-portal cluster analysis with biology descriptions
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api } from '../api.js'
import { useStore } from '../store.js'

const CELL_TYPES_LIST = [
  'CD4+ T cells', 'CD8+ T cells', 'NK / CD8+ T cells', 'NK cells', 'T cells',
  'B cells', 'Monocytes (CD14+)', 'Monocytes (FCGR3A+)', 'Monocytes',
  'Dendritic cells', 'Megakaryocytes', 'Unknown',
]

const CELL_TYPE_COLORS = {
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

function getBadgeStyle(name) {
  const color = CELL_TYPE_COLORS[name] || '#64748b'
  return {
    display: 'inline-flex', alignItems: 'center',
    padding: '2px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600,
    border: `1px solid ${color}40`,
    background: `${color}18`, color,
  }
}

export default function ClustersPage() {
  const [clusters,    setClusters]    = useState([])
  const [selected,    setSelected]    = useState(null)
  const [markers,     setMarkers]     = useState('')
  const [markLoading, setMarkLoading] = useState(false)
  const [comparing,   setComparing]   = useState({ a: '0', b: '1' })
  const [degData,     setDegData]     = useState(null)
  const [degLoading,  setDegLoading]  = useState(false)
  const [activeTab,   setActiveTab]   = useState('overview')

  const annotations   = useStore(s => s.annotations)
  const setAnnotation = useStore(s => s.setAnnotation)

  useEffect(() => {
    api.clusterSummary()
      .then(r => {
        setClusters(r.clusters)
        if (r.clusters.length) setSelected(r.clusters[0].cluster)
      })
      .catch(console.error)
    api.annotations()
      .then(a => useStore.getState().setAnnotations(a))
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (selected === null) return
    setMarkLoading(true)
    api.query(`Top markers cluster ${selected}`)
      .then(res => setMarkers(res.data))
      .catch(e => setMarkers(`Error: ${e.message}`))
      .finally(() => setMarkLoading(false))
  }, [selected])

  const handleAnnotate = async (cluster, label) => {
    try {
      await api.annotateCluster(cluster, label)
      setAnnotation(cluster, label)
    } catch (e) { console.error(e) }
  }

  const runDEG = () => {
    if (comparing.a === comparing.b) return
    setDegLoading(true)
    setDegData(null)
    api.clusterCompare(comparing.a, comparing.b)
      .then(setDegData)
      .catch(console.error)
      .finally(() => setDegLoading(false))
  }

  const selectedCluster = clusters.find(c => c.cluster === selected)
  const selectedName    = selectedCluster ? (annotations[selected] || selectedCluster.annotation) : ''
  const selectedColor   = CELL_TYPE_COLORS[selectedName] || '#64748b'

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* Cluster list */}
      <div style={{
        width: 200, flexShrink: 0,
        borderRight: '1px solid #1e293b',
        background: '#070b14',
        overflowY: 'auto', padding: 10,
        display: 'flex', flexDirection: 'column', gap: 3,
      }}>
        <p style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, padding: '4px 6px' }}>
          Clusters
        </p>
        {clusters.map(c => {
          const name  = annotations[c.cluster] || c.annotation
          const color = CELL_TYPE_COLORS[name] || c.color || '#64748b'
          const isSelected = c.cluster === selected
          return (
            <button key={c.cluster}
              onClick={() => { setSelected(c.cluster); setActiveTab('markers') }}
              style={{
                width: '100%', textAlign: 'left', padding: '8px 10px',
                borderRadius: 8, cursor: 'pointer', border: 'none',
                background: isSelected ? `${color}15` : 'transparent',
                outline: isSelected ? `1px solid ${color}40` : '1px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: isSelected ? '#e2e8f0' : '#94a3b8' }}>
                  Cluster {c.cluster}
                </span>
              </div>
              <div style={{ marginLeft: 15 }}>
                <span style={{ fontSize: 9, color: '#475569' }}>{c.n_cells.toLocaleString()} cells</span>
              </div>
              <div style={{ marginLeft: 15, marginTop: 3 }}>
                <span style={getBadgeStyle(name)}>{name}</span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Main panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Sub-tabs */}
        <div style={{
          display: 'flex', gap: 2, padding: '6px 14px',
          borderBottom: '1px solid #1e293b', background: '#0a1020', flexShrink: 0,
        }}>
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'markers',  label: 'Marker Genes' },
            { id: 'compare',  label: 'DEG Compare' },
            { id: 'annotate', label: 'Annotate Types' },
          ].map(t => (
            <button key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '5px 14px', borderRadius: 7, fontSize: 11, fontWeight: 500,
                cursor: 'pointer', transition: 'all 0.15s', border: 'none',
                background: activeTab === t.id ? '#2563eb' : 'transparent',
                color: activeTab === t.id ? '#fff' : '#64748b',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>Cluster Composition</h2>
                <p style={{ fontSize: 10, color: '#475569', marginTop: 3 }}>
                  Leiden clusters automatically annotated with known PBMC marker genes
                </p>
              </div>

              <div className="portal-card overflow-hidden">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Cluster</th>
                      <th>Cell Type</th>
                      <th>Cells</th>
                      <th>Proportion</th>
                      <th>Key Markers</th>
                      <th>Biological Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clusters.map(c => {
                      const name  = annotations[c.cluster] || c.annotation
                      const color = CELL_TYPE_COLORS[name] || c.color || '#64748b'
                      return (
                        <tr key={c.cluster} style={{ cursor: 'pointer' }}
                          onClick={() => { setSelected(c.cluster); setActiveTab('markers') }}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#cbd5e1' }}>
                                C{c.cluster}
                              </span>
                            </div>
                          </td>
                          <td><span style={getBadgeStyle(name)}>{name}</span></td>
                          <td style={{ fontFamily: "'JetBrains Mono', monospace" }}>{c.n_cells.toLocaleString()}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 60, height: 5, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ width: `${c.pct}%`, height: '100%', background: color, borderRadius: 3 }} />
                              </div>
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#64748b' }}>
                                {c.pct.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                              {c.top_genes.slice(0, 3).map(g => (
                                <span key={g} style={{
                                  padding: '1px 6px', borderRadius: 4,
                                  background: '#0f172a', color: '#93c5fd',
                                  fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 600,
                                }}>
                                  {g}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td style={{ maxWidth: 200, color: '#475569', fontSize: 10, lineHeight: 1.5 }}>
                            {c.description || '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MARKER GENES */}
          {activeTab === 'markers' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {selectedCluster && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <h2 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>
                      Marker Genes · Cluster {selected}
                    </h2>
                    <p style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
                      Wilcoxon rank-sum test vs all other clusters · Adj. p-value (Benjamini-Hochberg)
                    </p>
                  </div>
                  <span style={getBadgeStyle(selectedName)}>{selectedName}</span>
                  {selectedCluster.description && (
                    <p style={{
                      fontSize: 10, color: '#475569', fontStyle: 'italic',
                      padding: '5px 12px', background: `${selectedColor}10`,
                      border: `1px solid ${selectedColor}25`, borderRadius: 8, flexShrink: 0,
                      maxWidth: 400,
                    }}>
                      {selectedCluster.description}
                    </p>
                  )}
                </div>
              )}
              {markLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569', padding: '20px 0' }}>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  <span style={{ fontSize: 12 }}>Running Wilcoxon rank-sum test…</span>
                </div>
              ) : (
                <div className="prose-dark portal-card p-4">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{markers}</ReactMarkdown>
                </div>
              )}
            </div>
          )}

          {/* DEG COMPARE */}
          {activeTab === 'compare' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>
                  Differential Expression
                </h2>
                <p style={{ fontSize: 10, color: '#475569', marginTop: 3 }}>
                  Wilcoxon rank-sum test between any two clusters. Positive Log2FC = upregulated in Cluster A.
                </p>
              </div>

              <div className="portal-card p-4" style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                {[
                  { key: 'a', label: 'Cluster A (target)' },
                  { key: 'b', label: 'Cluster B (reference)' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <p style={{ fontSize: 10, color: '#475569', marginBottom: 5, fontWeight: 600 }}>{label}</p>
                    <select
                      value={comparing[key]}
                      onChange={e => setComparing(p => ({ ...p, [key]: e.target.value }))}
                      style={{
                        background: '#0d1526', border: '1px solid #1e293b', color: '#e2e8f0',
                        fontSize: 12, borderRadius: 8, padding: '6px 12px', outline: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {clusters.map(c => (
                        <option key={c.cluster} value={c.cluster}>
                          Cluster {c.cluster} · {annotations[c.cluster] || c.annotation}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                <button onClick={runDEG} disabled={comparing.a === comparing.b || degLoading}
                  className="portal-btn" style={{ flexShrink: 0 }}>
                  {degLoading
                    ? <>⏳ Running…</>
                    : <>▶ Run DEG Analysis</>
                  }
                </button>
              </div>

              {degData && (
                <div>
                  <p style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>
                    {degData.genes.length} top differentially expressed genes ·
                    Cluster <span style={{ color: '#93c5fd', fontWeight: 700 }}>{degData.cluster_a}</span> vs
                    Cluster <span style={{ color: '#f97316', fontWeight: 700 }}>{degData.cluster_b}</span>
                  </p>
                  <div className="portal-card overflow-hidden">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Gene</th>
                          <th>Score</th>
                          <th>Log2FC</th>
                          <th>Adj. p-value</th>
                          <th>Direction</th>
                        </tr>
                      </thead>
                      <tbody>
                        {degData.genes.map((g, i) => {
                          const lfc = degData.logfoldchanges[i]
                          const up  = lfc > 0
                          return (
                            <tr key={g}>
                              <td style={{ color: '#334155', fontFamily: "'JetBrains Mono', monospace" }}>{i + 1}</td>
                              <td style={{ fontFamily: "'JetBrains Mono', monospace', fontWeight: 700" }}>
                                <span style={{ color: '#93c5fd', fontWeight: 700 }}>{g}</span>
                              </td>
                              <td style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                                {degData.scores[i].toFixed(2)}
                              </td>
                              <td style={{
                                fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
                                color: up ? '#22c55e' : '#f87171',
                              }}>
                                {up ? '▲' : '▼'} {Math.abs(lfc).toFixed(3)}
                              </td>
                              <td style={{ fontFamily: "'JetBrains Mono', monospace", color: '#64748b' }}>
                                {degData.pvals_adj[i] < 0.001
                                  ? degData.pvals_adj[i].toExponential(2)
                                  : degData.pvals_adj[i].toFixed(4)
                                }
                              </td>
                              <td>
                                <span style={{
                                  padding: '2px 7px', borderRadius: 4, fontSize: 9, fontWeight: 700,
                                  background: up ? '#14532d50' : '#7f1d1d50',
                                  color: up ? '#4ade80' : '#f87171',
                                  border: `1px solid ${up ? '#14532d' : '#7f1d1d'}`,
                                }}>
                                  {up ? `↑ C${degData.cluster_a}` : `↓ C${degData.cluster_b}`}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ANNOTATE */}
          {activeTab === 'annotate' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>Cell Type Annotation</h2>
                <p style={{ fontSize: 10, color: '#475569', marginTop: 3 }}>
                  Review auto-detected cell types based on marker gene expression. Override as needed.
                  Labels persist for the session.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {clusters.map(c => {
                  const name  = annotations[c.cluster] || c.annotation
                  const color = CELL_TYPE_COLORS[name] || c.color || '#64748b'
                  return (
                    <div key={c.cluster} className="portal-card p-4"
                      style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>Cluster {c.cluster}</span>
                          <span style={{ fontSize: 9, color: '#475569', marginLeft: 8 }}>{c.n_cells.toLocaleString()} cells · {c.pct.toFixed(1)}%</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                          {c.top_genes.slice(0,5).map(g => (
                            <span key={g} style={{
                              padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace",
                              background: '#0f172a', color: '#93c5fd', border: '1px solid #1e293b',
                            }}>{g}</span>
                          ))}
                        </div>
                        {c.description && (
                          <p style={{ fontSize: 10, color: '#334155', marginTop: 4, fontStyle: 'italic' }}>{c.description}</p>
                        )}
                      </div>
                      <select
                        value={name}
                        onChange={e => handleAnnotate(c.cluster, e.target.value)}
                        style={{
                          background: '#0d1526', border: `1px solid ${color}40`,
                          color: color, fontSize: 11, borderRadius: 8, padding: '6px 12px',
                          outline: 'none', cursor: 'pointer', fontWeight: 600, minWidth: 180,
                        }}
                      >
                        {CELL_TYPES_LIST.map(t => (
                          <option key={t} value={t} style={{ color: CELL_TYPE_COLORS[t] || '#64748b' }}>{t}</option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
