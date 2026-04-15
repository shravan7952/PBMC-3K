// pages/UMAPPage.jsx – TCGA-style UMAP explorer with side info panel
import { useState, useEffect } from 'react'
import InteractiveUMAP from '../components/InteractiveUMAP.jsx'
import GeneSearch from '../components/GeneSearch.jsx'
import { api } from '../api.js'
import { useNavigate } from 'react-router-dom'

const PRESETS = [
  { value: 'leiden',         label: 'Cell Type / Cluster',   icon: '◉' },
  { value: 'n_genes_by_counts', label: '# Genes per Cell',  icon: '📊' },
  { value: 'total_counts',   label: 'Total UMIs',            icon: '🔢' },
  { value: 'pct_counts_mt',  label: '% Mitochondrial',       icon: '⚡' },
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

export default function UMAPPage() {
  const [colorBy,     setColorBy]     = useState('leiden')
  const [geneColor,   setGeneColor]   = useState(null)
  const [activeColor, setActiveColor] = useState('leiden')
  const [clusters,    setClusters]    = useState([])
  const [annotations, setAnnotations] = useState({})
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([api.clusterSummary(), api.annotations()])
      .then(([summary, ann]) => {
        setClusters(summary.clusters)
        const map = {}
        summary.clusters.forEach(c => {
          map[c.cluster] = ann[c.cluster] || c.annotation
        })
        setAnnotations(map)
      })
      .catch(console.error)
  }, [])

  const handleGeneSelect = (gene) => {
    setGeneColor(gene)
    setActiveColor(gene || 'leiden')
  }

  const handlePreset = (val) => {
    setColorBy(val)
    setGeneColor(null)
    setActiveColor(val)
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* Main UMAP area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Controls bar */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 16px',
          borderBottom: '1px solid #1e293b', background: '#0a1020', flexShrink: 0,
          alignItems: 'center',
        }}>
          <p style={{ fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0 }}>
            Color by
          </p>
          {PRESETS.map(opt => (
            <button key={opt.value}
              onClick={() => handlePreset(opt.value)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
                fontWeight: 500, transition: 'all 0.15s',
                background: activeColor === opt.value ? '#1e3a8a50' : 'transparent',
                color: activeColor === opt.value ? '#93c5fd' : '#64748b',
                border: `1px solid ${activeColor === opt.value ? '#3b82f650' : '#1e293b'}`,
              }}
            >
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}

          <div style={{ width: 220, flexShrink: 0, marginLeft: 8 }}>
            <GeneSearch
              onSelect={handleGeneSelect}
              placeholder="Or color by gene…"
            />
          </div>

          {geneColor && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 8, fontSize: 11,
              background: '#1e3a8a30', border: '1px solid #3b82f640', color: '#93c5fd',
            }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{geneColor}</span>
              <button onClick={() => { setGeneColor(null); setActiveColor('leiden'); setColorBy('leiden') }}
                style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>
                ×
              </button>
            </div>
          )}
        </div>

        {/* UMAP */}
        <div style={{ flex: 1, padding: '16px', minHeight: 0, overflow: 'hidden' }}>
          <div style={{
            height: '100%', background: '#070b14',
            border: '1px solid #1e293b', borderRadius: 12,
            padding: '12px', overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <h2 style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>UMAP Embedding</h2>
                <p style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
                  {geneColor
                    ? `${geneColor} expression overlay · Magma colorscale`
                    : activeColor === 'leiden'
                      ? 'Colored by cell type (Leiden clusters)'
                      : `Colored by ${activeColor}`
                  } · Pan · Scroll to zoom · Hover for cell info
                </p>
              </div>
              <button
                onClick={() => navigate('/genes')}
                style={{
                  fontSize: 10, color: '#3b82f6', padding: '4px 10px',
                  border: '1px solid #3b82f640', borderRadius: 6,
                  background: '#1e3a8a20', cursor: 'pointer',
                }}
              >
                Gene Explorer →
              </button>
            </div>
            <InteractiveUMAP colorBy={activeColor} height={440} />
          </div>
        </div>
      </div>

      {/* Right info panel */}
      <div style={{
        width: '220px', flexShrink: 0,
        borderLeft: '1px solid #1e293b',
        background: '#070b14',
        overflowY: 'auto',
        padding: '16px 12px',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div>
          <p style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 10 }}>
            Cell Types
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {clusters.map(c => {
              const name  = annotations[c.cluster] || c.annotation
              const color = CELL_TYPE_COLORS[name] || c.color || '#64748b'
              return (
                <div key={c.cluster} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: '#94a3b8', flex: 1, lineHeight: 1.3 }}>{name}</span>
                    <span style={{ fontSize: 9, color: '#475569', fontFamily: "'JetBrains Mono', monospace" }}>
                      {c.pct.toFixed(0)}%
                    </span>
                  </div>
                  {/* Mini bar */}
                  <div style={{ marginLeft: 13, height: 3, background: '#1e293b', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${c.pct}%`, background: color, borderRadius: 2 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ borderTop: '1px solid #1e293b', paddingTop: 14 }}>
          <p style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 10 }}>
            Colour Presets
          </p>
          {PRESETS.map(opt => (
            <button key={opt.value}
              onClick={() => handlePreset(opt.value)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '6px 8px', borderRadius: 6, fontSize: 11,
                marginBottom: 2, cursor: 'pointer', transition: 'all 0.12s',
                background: activeColor === opt.value ? '#1e3a8a30' : 'transparent',
                color: activeColor === opt.value ? '#93c5fd' : '#64748b',
                border: `1px solid ${activeColor === opt.value ? '#3b82f640' : 'transparent'}`,
              }}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>

        <div style={{ borderTop: '1px solid #1e293b', paddingTop: 14 }}>
          <p style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 6 }}>
            About UMAP
          </p>
          <p style={{ fontSize: 10, color: '#334155', lineHeight: 1.6 }}>
            UMAP (Uniform Manifold Approximation and Projection) reduces dimensions to 2D
            preserving local cell-cell relationships. Each dot is one cell.
          </p>
        </div>
      </div>
    </div>
  )
}
