// store.js – Zustand global state for CodeCell.ai dashboard
import { create } from 'zustand'

export const useStore = create((set, get) => ({
  // ── Backend status ──────────────────────────────────────────
  backendReady: false,
  backendStats: { cells: 0, clusters: 0 },
  setBackendReady: (stats) => set({ backendReady: true, backendStats: stats }),

  // ── Active gene selection ───────────────────────────────────
  selectedGene: null,
  setSelectedGene: (gene) => set({ selectedGene: gene }),

  // ── UMAP color-by ──────────────────────────────────────────
  umapColorBy: 'leiden',
  setUmapColorBy: (val) => set({ umapColorBy: val }),

  // ── Cluster annotations (user-defined labels) ───────────────
  annotations: {},
  setAnnotation: (cluster, label) =>
    set((s) => ({ annotations: { ...s.annotations, [cluster]: label } })),
  setAnnotations: (all) => set({ annotations: all }),

  // ── Chat external query injection ──────────────────────────
  chatQuery: null,
  sendChatQuery: (text) => set({ chatQuery: { text, _ts: Date.now() } }),

  // ── Active plot from chat ───────────────────────────────────
  activePlot: null,
  setActivePlot: (plot) => set({ activePlot: plot }),
}))
