// PlotViewer.jsx – Displays the latest plot in a prominent card with zoom and download
import { useState } from 'react'

export default function PlotViewer({ src, title, timestamp }) {
  const [zoomed, setZoomed] = useState(false)

  if (!src) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-600 select-none">
        <div className="w-20 h-20 rounded-2xl bg-surface-600 border border-white/5 flex items-center justify-center">
          <svg className="w-8 h-8 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3.75 3v11.25A2.25 2.25 0 006 16.5h12M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-12m12-9v9m-9-9v9m-3-9v9" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-500">No visualization yet</p>
          <p className="text-xs text-slate-600 mt-1">Ask a question to generate a plot</p>
        </div>
        <div className="flex gap-2 mt-2">
          {['Show UMAP','Plot CD3D','Plot MS4A1'].map(q => (
            <span key={q} className="px-2 py-1 rounded-md text-[10px] border border-surface-400 text-slate-500">
              "{q}"
            </span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Main plot card */}
      <div className="h-full flex flex-col gap-3">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-1">
          <div>
            <p className="text-sm font-semibold text-slate-200">{title}</p>
            {timestamp && <p className="text-[10px] text-slate-500 mt-0.5">{timestamp}</p>}
          </div>
          <div className="flex items-center gap-2">
            {/* Zoom */}
            <button
              onClick={() => setZoomed(true)}
              title="Zoom"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
              </svg>
            </button>
            {/* Download */}
            <a
              href={src}
              download
              title="Download PNG"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 3v12"/>
              </svg>
            </a>
          </div>
        </div>

        {/* Plot image */}
        <div className="flex-1 flex items-center justify-center min-h-0">
          <img
            src={src}
            alt={title}
            className="plot-img max-h-full object-contain animate-fade-in cursor-zoom-in"
            onClick={() => setZoomed(true)}
          />
        </div>
      </div>

      {/* Lightbox */}
      {zoomed && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in"
          onClick={() => setZoomed(false)}
        >
          <div className="relative max-w-5xl w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setZoomed(false)}
              className="absolute -top-10 right-0 text-slate-400 hover:text-white text-sm flex items-center gap-1"
            >
              ✕ Close
            </button>
            <img src={src} alt={title} className="w-full rounded-2xl shadow-2xl border border-white/10" />
            <p className="text-center text-slate-400 text-xs mt-3">{title}</p>
          </div>
        </div>
      )}
    </>
  )
}
