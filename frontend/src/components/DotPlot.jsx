// DotPlot.jsx – Gene × Cluster dot plot (dot size = % expressing, color = mean expression)
import { useEffect, useState } from 'react'
import { api } from '../api.js'

const DEFAULT_GENES = ['CD3D', 'MS4A1', 'LYZ', 'CD79A', 'GNLY', 'NKG7', 'CD8A', 'PPBP']

// Map 0–max to a CSS color along the indigo→yellow magma-like scale
function exprToColor(value, max) {
  if (max === 0) return 'hsl(230,15%,20%)'
  const t = Math.min(value / max, 1)
  // Interpolate: dark → indigo → orange → yellow
  if (t < 0.33) {
    const s = t / 0.33
    return `hsl(${230 + s * 0},${15 + s * 55}%,${20 + s * 15}%)`
  } else if (t < 0.66) {
    const s = (t - 0.33) / 0.33
    return `hsl(${230 - s * 200},${70 - s * 10}%,${35 + s * 15}%)`
  } else {
    const s = (t - 0.66) / 0.34
    return `hsl(${30 + s * 30},${80 + s * 10}%,${50 + s * 15}%)`
  }
}

export default function DotPlot({ genes = DEFAULT_GENES }) {
  const [data,     setData]     = useState(null)
  const [clusters, setClusters] = useState([])
  const [maxExpr,  setMaxExpr]  = useState(1)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    api.dotplot(genes)
      .then(res => {
        if (cancelled) return
        const max = Math.max(...res.data.map(d => d.mean_expr))
        setMaxExpr(max || 1)
        setClusters(res.clusters)
        // Group by gene
        const byGene = {}
        for (const row of res.data) {
          if (!byGene[row.gene]) byGene[row.gene] = {}
          byGene[row.gene][row.cluster] = row
        }
        setData({ byGene, genes: res.genes })
      })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [genes.join(',')])

  if (loading) return (
    <div className="flex items-center justify-center h-40 text-slate-500 text-sm gap-2">
      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
      </svg>
      Building dot plot…
    </div>
  )

  if (error) return (
    <div className="text-red-400 text-sm p-3 bg-red-900/20 rounded-xl">⚠️ {error}</div>
  )

  if (!data) return null

  const cellSize = 36

  return (
    <div className="overflow-x-auto">
      <p className="text-[10px] text-slate-500 mb-4 px-1">
        Dot size = % cells expressing · Color = mean expression (log-normalized)
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: `80px repeat(${clusters.length}, ${cellSize}px)`, gap: 2 }}>
        {/* Cluster headers */}
        <div /> {/* empty corner */}
        {clusters.map(c => (
          <div key={c} className="text-center text-[10px] text-slate-500 font-medium pb-1">
            C{c}
          </div>
        ))}

        {/* Gene rows */}
        {data.genes.map(gene => (
          <>
            <div key={`label-${gene}`}
              className="text-[11px] text-slate-300 font-mono flex items-center pr-2 justify-end"
            >
              {gene}
            </div>
            {clusters.map(clus => {
              const d = data.byGene[gene]?.[clus]
              const pct  = d?.pct_expressing ?? 0
              const expr = d?.mean_expr ?? 0
              const size = Math.max(4, (pct / 100) * (cellSize - 6))
              const color = exprToColor(expr, maxExpr)
              return (
                <div key={`${gene}-${clus}`}
                  className="flex items-center justify-center"
                  style={{ width: cellSize, height: cellSize }}
                  title={`${gene} / Cluster ${clus}\nMean: ${expr.toFixed(2)}\n%Expr: ${pct.toFixed(0)}%`}
                >
                  <div
                    className="rounded-full transition-all duration-200 hover:opacity-80 cursor-default"
                    style={{ width: size, height: size, background: color }}
                  />
                </div>
              )
            })}
          </>
        ))}
      </div>

      {/* Color legend */}
      <div className="flex items-center gap-2 mt-4 px-1">
        <span className="text-[10px] text-slate-500">Low</span>
        <div className="h-2 w-32 rounded-full" style={{
          background: 'linear-gradient(to right, hsl(230,15%,20%), hsl(230,70%,35%), hsl(30,80%,50%), hsl(60,90%,65%))'
        }} />
        <span className="text-[10px] text-slate-500">High expression</span>
        <span className="text-[10px] text-slate-600 ml-4">◉ = 100% expressing</span>
        <span className="text-[10px] text-slate-600">· = 10% expressing</span>
      </div>
    </div>
  )
}
