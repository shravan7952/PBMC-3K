// InteractiveUMAP.jsx – Plotly UMAP with biology-aware cell type names in legend
import { useEffect, useRef, useState, useCallback } from 'react'
import { api } from '../api.js'

let Plotly = null

// Biology-accurate cell type colors (matches sidebar + cluster summary)
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

// Fallback palette for unnamed clusters
const FALLBACK_PALETTE = [
  '#60a5fa','#8b5cf6','#f97316','#10b981','#ec4899','#f59e0b',
  '#34d399','#fb923c','#38bdf8','#a3e635',
]

export default function InteractiveUMAP({ colorBy = 'leiden', height = 500, onCellHover }) {
  const plotDiv  = useRef(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [info,       setInfo]       = useState('')
  const [annotations, setAnnotations] = useState({})

  // Load cluster annotations once
  useEffect(() => {
    Promise.all([api.clusterSummary(), api.annotations()])
      .then(([summary, ann]) => {
        const map = {}
        summary.clusters.forEach(c => {
          map[c.cluster] = ann[c.cluster] || c.annotation
        })
        setAnnotations(map)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (Object.keys(annotations).length === 0 && colorBy === 'leiden') return
    let cancelled = false

    const loadPlotly = async () => {
      if (!Plotly) {
        const mod = await import('plotly.js-dist-min')
        Plotly = mod.default || mod
      }
    }

    const fetchAndRender = async () => {
      setLoading(true)
      setError(null)
      try {
        await loadPlotly()
        const data = await api.umapData(colorBy)
        if (cancelled) return

        let traces = []

        if (data.color_type === 'categorical') {
          // Group cells by cluster, label with cell type names
          const uniqueClusters = [...new Set(data.color_values)]
            .sort((a, b) => parseInt(a) - parseInt(b))

          traces = uniqueClusters.map((clus, i) => {
            const mask = data.color_values
              .map((v, j) => (v === clus ? j : -1))
              .filter(j => j >= 0)

            const cellTypeName = annotations[clus] || `Cluster ${clus}`
            const color = CELL_TYPE_COLORS[cellTypeName] || FALLBACK_PALETTE[i % FALLBACK_PALETTE.length]
            const cellCount = mask.length

            return {
              type: 'scattergl',
              mode: 'markers',
              name: `${cellTypeName} (${cellCount})`,
              x: mask.map(j => data.x[j]),
              y: mask.map(j => data.y[j]),
              text: mask.map(j =>
                `<b>${cellTypeName}</b><br>` +
                `Cluster: ${clus}<br>` +
                `Cell: ${data.cell_ids[j]}`
              ),
              hovertemplate: '%{text}<extra></extra>',
              marker: {
                size: 4,
                color,
                opacity: 0.85,
                line: { width: 0 },
              },
            }
          })
        } else {
          // Continuous coloring (gene expression or QC metric)
          traces = [{
            type: 'scattergl',
            mode: 'markers',
            name: data.color_label,
            x: data.x,
            y: data.y,
            text: data.cell_ids.map((id, j) => {
              const cellType = annotations[data.clusters[j]] || `Cluster ${data.clusters[j]}`
              const val = typeof data.color_values[j] === 'number'
                ? data.color_values[j].toFixed(3)
                : data.color_values[j]
              return `<b>${cellType}</b><br>${data.color_label}: ${val}<br>Cell: ${id}`
            }),
            hovertemplate: '%{text}<extra></extra>',
            marker: {
              size: 4,
              color: data.color_values,
              colorscale: 'Magma',
              reversescale: false,
              opacity: 0.9,
              showscale: true,
              colorbar: {
                title: { text: data.color_label, font: { color: '#9ca3af', size: 11 } },
                tickfont: { color: '#9ca3af', size: 10 },
                bgcolor: 'rgba(0,0,0,0)',
                bordercolor: 'rgba(255,255,255,0.08)',
                thickness: 12,
                len: 0.6,
              },
              line: { width: 0 },
            },
          }]
        }

        const layout = {
          paper_bgcolor: '#070b14',
          plot_bgcolor:  '#0d1526',
          margin: { l: 44, r: 16, t: 24, b: 44 },
          xaxis: {
            title: { text: 'UMAP 1', font: { color: '#475569', size: 10 } },
            tickfont: { color: '#475569', size: 9 },
            gridcolor: '#1e293b',
            zerolinecolor: '#1e293b',
          },
          yaxis: {
            title: { text: 'UMAP 2', font: { color: '#475569', size: 10 } },
            tickfont: { color: '#475569', size: 9 },
            gridcolor: '#1e293b',
            zerolinecolor: '#1e293b',
          },
          legend: {
            font: { color: '#94a3b8', size: 10 },
            bgcolor: 'rgba(7,11,20,0.85)',
            bordercolor: '#1e293b',
            borderwidth: 1,
            itemsizing: 'constant',
            x: 1.01,
            xanchor: 'left',
            y: 1,
          },
          dragmode: 'pan',
          hovermode: 'closest',
        }

        const config = {
          responsive: true,
          displayModeBar: true,
          modeBarButtonsToRemove: ['sendDataToCloud', 'autoScale2d', 'lasso2d'],
          displaylogo: false,
          toImageButtonOptions: {
            format: 'png',
            filename: `umap_${colorBy}`,
            scale: 3,
            width: 1200,
            height: 900,
          },
        }

        await Plotly.react(plotDiv.current, traces, layout, config)
        setInfo(`${data.n_cells.toLocaleString()} cells · colored by ${data.color_label}`)
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAndRender()
    return () => { cancelled = true }
  }, [colorBy, annotations])

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {info && (
        <p className="text-[10px] text-slate-500 font-mono px-1">{info}</p>
      )}
      {loading && (
        <div className="flex items-center justify-center gap-2 text-slate-500"
          style={{ height }}>
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
          <span className="text-sm">Loading UMAP data…</span>
        </div>
      )}
      {error && (
        <div className="text-red-400 text-sm px-4 py-3 bg-red-900/20 rounded-xl border border-red-800/30">
          ⚠️ {error}
        </div>
      )}
      <div
        ref={plotDiv}
        style={{ height, width: '100%', display: loading || error ? 'none' : 'block' }}
      />
    </div>
  )
}
