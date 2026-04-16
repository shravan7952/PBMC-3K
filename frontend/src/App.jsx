// App.jsx – Root layout with React Router, fixed scrolling, TCGA portal design
import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header       from './components/Header.jsx'
import Sidebar      from './components/Sidebar.jsx'
import TabBar       from './components/TabBar.jsx'
import HomePage     from './pages/HomePage.jsx'
import UMAPPage     from './pages/UMAPPage.jsx'
import GenesPage    from './pages/GenesPage.jsx'
import ClustersPage from './pages/ClustersPage.jsx'
import QCPage       from './pages/QCPage.jsx'
import ChatPage     from './pages/ChatPage.jsx'
import { useStore } from './store.js'
import { api } from './api.js'

function AppShell() {
  const [sidebarOpen,  setSidebarOpen]  = useState(true)
  const setBackendReady = useStore(s => s.setBackendReady)

  // Poll backend health until ready
  useEffect(() => {
    const check = async () => {
      try {
        const h = await api.health()
        if (h.status === 'ready') {
          setBackendReady({ cells: h.cells, clusters: h.clusters })
        }
      } catch { /* silent until ready */ }
    }
    check()
    const id = setInterval(check, 4000)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#070b14', color: '#e2e8f0' }}>

      {/* Fixed top bar */}
      <Header />

      {/* Below header — flex row, fills remaining height */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* Collapsible sidebar */}
        <div style={{
          width: sidebarOpen ? '224px' : '0',
          minWidth: sidebarOpen ? '224px' : '0',
          overflow: 'hidden',
          transition: 'width 0.25s ease, min-width 0.25s ease',
          flexShrink: 0,
        }}>
          <Sidebar
            onQuery={(q) => {
              useStore.getState().sendChatQuery(q)
              // Trigger navigation via hash change (no router context needed)
              window.dispatchEvent(new CustomEvent('navigate-chat'))
            }}
          />
        </div>

        {/* Main column */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>

          {/* Tab bar row */}
          <div style={{
            display: 'flex', alignItems: 'center', flexShrink: 0,
            borderBottom: '1px solid #1e293b', background: '#0a1020',
          }}>
            {/* Sidebar toggle */}
            <button
              onClick={() => setSidebarOpen(s => !s)}
              style={{ padding: '8px 12px', color: '#475569', flexShrink: 0, cursor: 'pointer', background: 'transparent', border: 'none', borderRight: '1px solid #1e293b' }}
              title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {sidebarOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M18 19l-7-7 7-7"/>
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M6 5l7 7-7 7"/>
                }
              </svg>
            </button>
            <TabBar />
          </div>

          {/* Page content — THIS IS THE SCROLLABLE AREA */}
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
            <Routes>
              <Route path="/"         element={<HomePage />} />
              <Route path="/umap"     element={<UMAPPage />} />
              <Route path="/genes"    element={<GenesPage />} />
              <Route path="/clusters" element={<ClustersPage />} />
              <Route path="/qc"       element={<QCPage />} />
              <Route path="/chat"     element={<ChatPage />} />
            </Routes>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}
