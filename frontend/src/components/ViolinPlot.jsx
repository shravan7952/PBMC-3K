// ViolinPlot.jsx – Per-cluster violin with CELL TYPE names on X-axis
import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { api } from '../api.js'

// Biology-accurate colors matching the rest of the dashboard
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
const FALLBACK = ['#60a5fa','#8b5cf6','#f97316','#10b981','#ec4899','#f59e0b']

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div style={{
      background: '#0d1526', border: '1px solid #1e293b', borderRadius: 10,
      padding: '8px 12px', fontSize: 11, minWidth: 180,
    }}>
      <p style={{ fontWeight: 700, color: d.color || '#e2e8f0', marginBottom: 4 }}>{d.cellType}</p>
      <p style={{ color: '#64748b' }}>Cluster: <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>{d.cluster}</span></p>
      <p style={{ color: '#64748b' }}>Mean expr: <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{d.mean?.toFixed(4)}</span></p>
      <p style={{ color: '#64748b' }}>Median: <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{d.median?.toFixed(4)}</span></p>
      <p style={{ color: '#64748b' }}>IQR: <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{d.q25?.toFixed(2)} – {d.q75?.toFixed(2)}</span></p>
      <p style={{ color: '#64748b' }}>% Expressing: <span style={{ color: '#22c55e', fontWeight: 700 }}>{d.pct_expressing?.toFixed(1)}%</span></p>
    </div>
  )
}

// Custom X-axis tick — wraps long cell type names
const CustomXTick = ({ x, y, payload }) => {
  const words = (payload.value || '').split(' ')
  return (
    <g transform={`translate(${x},${y})`}>
      {words.map((word, i) => (
        <text key={i} x={0} y={0} dy={14 + i * 13} textAnchor="middle"
          fill="#64748b" fontSize={9} fontFamily="'Inter', sans-serif">
          {word}
        </text>
      ))}
    </g>
  )
}

export default function ViolinPlot({ gene }) {
  const [data,        setData]        = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)
  const [annotations, setAnnotations] = useState({})

  // Load cell type annotations once
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
    if (!gene) return
    let cancelled = false
    setLoading(true)
    setError(null)

    api.violin(gene)
      .then(res => {
        if (cancelled) return
        const chartData = res.clusters.map((clus, i) => {
          const d = res.per_cluster[clus]
          const cellType = annotations[clus] || `Cluster ${clus}`
          const color    = CELL_TYPE_COLORS[cellType] || FALLBACK[i % FALLBACK.length]
          return {
            cluster:       clus,
            cellType,
            color,
            // X-axis key — short label for the bar
            label: cellType,
            iqrStart:      d.q25,
            iqrHeight:     Math.max(d.q75 - d.q25, 0.005),
            whiskerHeight: d.max,
            mean:          d.mean,
            median:        d.median,
            q25:           d.q25,
            q75:           d.q75,
            pct_expressing: d.pct_expressing,
          }
        })
        setData(chartData)
      })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [gene, annotations])

  if (!gene) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#334155', fontSize: 13 }}>
      Select a gene to view expression per cluster
    </div>
  )

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8, color: '#475569' }}>
      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
      </svg>
      <span style={{ fontSize: 13 }}>Loading {gene} expression data…</span>
    </div>
  )

  if (error) return (
    <div style={{ color: '#f87171', fontSize: 12, padding: '12px', background: '#7f1d1d20', borderRadius: 8, border: '1px solid #7f1d1d40' }}>
      ⚠️ {error}
    </div>
  )

  if (!data) return null

  // Custom bar renderer with per-bar colors
  const ColoredBar = (props) => {
    const { x, y, width, height, index } = props
    if (!data[index]) return null
    return <rect x={x} y={y} width={width} height={Math.max(height, 1)} fill={data[index].color} fillOpacity={0.82} rx={3} ry={3} />
  }

  const WiskerBar = (props) => {
    const { x, y, width, height, index } = props
    if (!data[index]) return null
    return <rect x={x} y={y} width={width} height={Math.max(height, 1)} fill={data[index].color} fillOpacity={0.15} rx={3} ry={3} />
  }

  return (
    <div>
      <p style={{ fontSize: 10, color: '#475569', marginBottom: 12, lineHeight: 1.5 }}>
        Expression distribution of{' '}
        <span style={{ color: '#93c5fd', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{gene}</span>
        {' '}per cell type · IQR box (solid) + max whisker (faint) · Hover for stats
      </p>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 52 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="label"
            tick={<CustomXTick />}
            axisLine={{ stroke: '#1e293b' }}
            tickLine={false}
            interval={0}
            height={60}
          />
          <YAxis
            tick={{ fill: '#475569', fontSize: 9 }}
            axisLine={{ stroke: '#1e293b' }}
            tickLine={false}
            width={38}
            label={{ value: 'Expression', angle: -90, position: 'insideLeft', offset: 14, fill: '#334155', fontSize: 10 }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b50' }} />
          {/* Full-range whisker (faint background) */}
          <Bar dataKey="whiskerHeight" barSize={28} shape={<WiskerBar />} />
          {/* IQR box (solid color) */}
          <Bar dataKey="iqrHeight" barSize={28} shape={<ColoredBar />} />
        </ComposedChart>
      </ResponsiveContainer>

      {/* % expressing legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {data.map((d) => (
          <div key={d.cluster} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: d.color, display: 'inline-block' }} />
            <span style={{ color: '#475569', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.cellType}:</span>
            <span style={{ color: '#22c55e', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
              {d.pct_expressing.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
