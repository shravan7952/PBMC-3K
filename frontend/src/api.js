// api.js – Centralised API client for all backend endpoints
const BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

async function get(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  health:          ()                 => get('/health'),
  umapData:        (colorBy='leiden') => get(`/umap-data?color_by=${encodeURIComponent(colorBy)}`),
  qcMetrics:       ()                 => get('/qc-metrics'),
  geneList:        (q='', limit=60)   => get(`/gene-list?q=${encodeURIComponent(q)}&limit=${limit}`),
  violin:          (gene)             => get(`/violin?gene=${encodeURIComponent(gene)}`),
  dotplot:         (genes)            => get(`/dotplot?genes=${encodeURIComponent(genes.join(','))}`),
  clusterSummary:  ()                 => get('/cluster-summary'),
  clusterCompare:  (a, b)             => get(`/cluster-compare?a=${a}&b=${b}`),
  annotateCluster: (cluster, label)   => post('/annotate-cluster', { cluster, label }),
  annotations:     ()                 => get('/annotations'),
  query:           (q)                => post('/query', { query: q }),

  // ── Gemini conversational AI (falls back to built-in when no API key) ──
  chat:       (message, history = []) => post('/chat', { message, history }),
  chatStatus: ()                      => get('/chat-status'),
}
