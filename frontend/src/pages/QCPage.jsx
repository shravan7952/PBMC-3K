// pages/QCPage.jsx – TCGA-portal style quality control dashboard
import { useEffect, useState } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts'
import { api } from '../api.js'

function buildHistogram(values, bins = 30) {
  if (!values || !values.length) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) return [{ x: min.toFixed(1), count: values.length }]
  const step = (max - min) / bins
  const counts = Array(bins).fill(0)
  for (const v of values) {
    const i = Math.min(Math.floor((v - min) / step), bins - 1)
    counts[i]++
  }
  return counts.map((count, i) => ({
    x: +(min + i * step).toFixed(1),
    count,
  }))
}

const ScatterTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="portal-card p-2 text-xs space-y-0.5 shadow-portal">
      <p className="text-white font-mono font-semibold">{d?.cluster !== undefined ? `Cluster ${d.cluster}` : ''}</p>
      <p><span className="text-slate-500">UMIs: </span><span className="text-slate-200 font-mono">{d?.x?.toLocaleString()}</span></p>
      <p><span className="text-slate-500">Genes: </span><span className="text-slate-200 font-mono">{d?.y?.toLocaleString()}</span></p>
      <p><span className="text-slate-500">%MT: </span>
        <span className={d?.mt > 5 ? 'text-red-400 font-mono' : 'text-emerald-400 font-mono'}>{d?.mt?.toFixed(2)}%</span>
      </p>
    </div>
  )
}

function MetricCard({ label, value, sub, status }) {
  const statusColor = status === 'good' ? 'text-emerald-400'
    : status === 'warn' ? 'text-amber-400'
    : status === 'bad'  ? 'text-red-400'
    : 'text-blue-300'

  return (
    <div className="portal-card p-4">
      <p className={`text-xl font-bold font-mono ${statusColor}`}>{value}</p>
      <p className="text-[10px] text-slate-400 font-medium mt-1">{label}</p>
      {sub && <p className="text-[9px] text-slate-600 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function QCPage() {
  const [qc,      setQc]      = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    api.qcMetrics().then(setQc).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: '#475569' }}>
      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
      </svg>
      <span style={{ fontSize: 13 }}>Loading QC metrics…</span>
    </div>
  )
  if (error)  return <div style={{ padding: 24, color: '#f87171' }}>⚠️ {error}</div>
  if (!qc)    return null

  const { stats, scatter, histograms } = qc

  const scatterData = scatter.x.map((x, i) => ({
    x, y: scatter.y[i], mt: scatter.pct_mt[i], cluster: scatter.clusters[i],
  }))
  const step    = Math.max(1, Math.floor(scatterData.length / 800))
  const sampled = scatterData.filter((_, i) => i % step === 0)

  const histGenes = buildHistogram(histograms.n_genes)
  const histUMI   = buildHistogram(histograms.total_counts, 25)
  const histMT    = buildHistogram(histograms.pct_mt, 20)

  return (
    <div className="page-scroll">
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '20px 24px 40px' }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>Quality Control</h1>
        <p style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
          Post-filter metrics · min 200 genes/cell · max 5% mitochondrial reads · min 3 cells/gene
        </p>
      </div>

      {/* QC Pipeline info banner */}
      <div className="portal-card p-4" style={{ background: '#0d1f3a', borderColor: '#1e3a8a50' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 14 }}>ℹ️</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#93c5fd' }}>Pre-processing QC filters applied</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {[
            'Removed cells with < 200 genes',
            'Removed cells with > 5% MT reads',
            'Removed genes expressed in < 3 cells',
            'Normalized to 10,000 UMIs per cell',
          ].map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#64748b' }}>
              <span style={{ color: '#22c55e', fontSize: 12 }}>✓</span> {s}
            </div>
          ))}
        </div>
      </div>

      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
        <MetricCard label="Cells (post-QC)"   value={stats.total_cells.toLocaleString()}  status="good" />
        <MetricCard label="Genes detected"     value={stats.total_genes.toLocaleString()}  status="default" />
        <MetricCard label="Leiden clusters"    value={stats.n_clusters}                   status="default" />
        <MetricCard label="Median genes/cell"  value={Math.round(stats.median_genes).toLocaleString()}
          sub={`typically 500–3,000`} status={stats.median_genes > 300 ? 'good' : 'warn'} />
        <MetricCard label="Median UMIs/cell"   value={Math.round(stats.median_umi).toLocaleString()}
          sub="total counts" status={stats.median_umi > 500 ? 'good' : 'warn'} />
        <MetricCard label="Median %MT"         value={`${stats.median_pct_mt.toFixed(2)}%`}
          sub="< 5% is healthy"
          status={stats.median_pct_mt < 3 ? 'good' : stats.median_pct_mt < 5 ? 'warn' : 'bad'} />
      </div>

      {/* Main scatter */}
      <div className="portal-card p-5">
        <div style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>UMI Count vs Genes Detected per Cell</h2>
          <p style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
            Joint distribution of library complexity. Outliers may indicate doublets or low-quality cells.
            Showing {sampled.length.toLocaleString()} / {scatterData.length.toLocaleString()} cells.
          </p>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="x" type="number" name="Total UMIs"
              tick={{ fill: '#475569', fontSize: 10 }} tickLine={false}
              label={{ value: 'Total UMIs (log scale approx.)', position: 'insideBottom', offset: -16, fill: '#334155', fontSize: 10 }} />
            <YAxis dataKey="y" type="number" name="n_genes"
              tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} width={42}
              label={{ value: 'Genes / Cell', angle: -90, position: 'insideLeft', offset: 10, fill: '#334155', fontSize: 10 }} />
            <Tooltip content={<ScatterTooltip />} cursor={{ stroke: '#3b82f640', strokeWidth: 1 }} />
            <Scatter data={sampled} fill="#3b82f6" opacity={0.45} r={2} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Histogram trio */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {[
          {
            title: 'Genes per Cell',
            subtitle: 'n_genes_by_counts distribution',
            data: histGenes, color: '#60a5fa',
            refLine: 200, refLabel: 'min filter',
          },
          {
            title: 'UMIs per Cell',
            subtitle: 'total_counts distribution',
            data: histUMI, color: '#34d399',
          },
          {
            title: '% Mitochondrial Reads',
            subtitle: 'pct_counts_mt distribution',
            data: histMT, color: '#f97316',
            refLine: 5, refLabel: 'max filter (5%)',
          },
        ].map(({ title, subtitle, data, color }) => (
          <div key={title} className="portal-card p-4">
            <div style={{ marginBottom: 10 }}>
              <h3 style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1' }}>{title}</h3>
              <p style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{subtitle}</p>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={data} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="x" tick={{ fill: '#334155', fontSize: 8 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#334155', fontSize: 8 }} tickLine={false} axisLine={false} width={26} />
                <Tooltip
                  formatter={(v) => [v.toLocaleString(), 'Cells']}
                  contentStyle={{ background: '#0d1526', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: '#64748b', fontSize: 10 }}
                />
                <Bar dataKey="count" fill={color} fillOpacity={0.8} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>

    </div>
    </div>
  )
}
