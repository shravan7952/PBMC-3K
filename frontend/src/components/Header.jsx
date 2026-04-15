// Header.jsx – TCGA-portal style top bar with real CodeCell.ai logo
import { useState, useEffect } from 'react'
import { useStore } from '../store.js'
import { api } from '../api.js'

export default function Header() {
  const backendReady = useStore(s => s.backendReady)
  const backendStats = useStore(s => s.backendStats)

  return (
    <header className="shrink-0 border-b border-slate-800 bg-portal-900 z-30">
      {/* Top accent line */}
      <div className="h-0.5 bg-gradient-to-r from-blue-600 via-blue-400 to-cyan-500" />

      <div className="flex items-center justify-between px-5 py-2.5">
        {/* Logo + brand */}
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="CodeCell.ai"
            className="h-9 w-9 object-contain"
            style={{ filter: 'invert(1)', mixBlendMode: 'screen' }}
          />
          <div className="flex flex-col">
            <span className="text-sm font-bold text-white tracking-tight leading-none">
              CodeCell<span className="text-blue-400">.ai</span>
            </span>
            <span className="text-[9px] text-slate-500 font-mono leading-tight mt-0.5">
              ATCG meets 0110101
            </span>
          </div>

          {/* Divider */}
          <div className="h-7 w-px bg-slate-800 mx-2" />

          {/* Dataset badge */}
          <div className="hidden sm:flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500">Dataset</span>
              <span className="text-slate-200 font-medium">PBMC 3K</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-mono">hg19</span>
            </div>
          </div>
        </div>

        {/* Right: stats + status */}
        <div className="flex items-center gap-3">
          {/* Stats pills */}
          {backendReady && (
            <div className="hidden md:flex items-center gap-2">
              {[
                { label: 'Cells',    value: backendStats.cells.toLocaleString() },
                { label: 'Clusters', value: backendStats.clusters },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700 text-[11px]">
                  <span className="text-slate-500">{s.label}</span>
                  <span className="text-slate-200 font-semibold font-mono">{s.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Status dot */}
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${backendReady ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
            <span className="text-[10px] text-slate-500">
              {backendReady ? 'Ready' : 'Preprocessing…'}
            </span>
          </div>

          {/* Docs link */}
          <a href="https://scanpy.readthedocs.io" target="_blank" rel="noreferrer"
            className="hidden sm:flex items-center gap-1 text-[10px] text-slate-500 hover:text-blue-400 transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
            </svg>
            Scanpy docs
          </a>
        </div>
      </div>
    </header>
  )
}
