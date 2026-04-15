// pages/ChatPage.jsx – AI Assistant with suggested queries panel
import ChatWindow from '../components/ChatWindow.jsx'
import { useStore } from '../store.js'

const SUGGESTED_QUERIES = [
  {
    category: '🗺️ Visualization',
    queries: [
      'Show UMAP',
      'Plot CD3D',
      'Plot MS4A1',
      'Plot NKG7',
      'Plot LYZ',
      'Plot PF4',
    ],
  },
  {
    category: '🧫 Cell Types',
    queries: [
      'What are B cells?',
      'Explain monocytes',
      'Tell me about NK cells',
      'What are dendritic cells?',
      'What are megakaryocytes?',
      'What are CD4+ T cells?',
    ],
  },
  {
    category: '🔬 Gene Biology',
    queries: [
      'What is CD79A?',
      'What does GZMA do?',
      'Explain NKG7',
      'What is IL7R?',
      'What does LYZ do?',
      'What is CCR7?',
    ],
  },
  {
    category: '📊 Analysis',
    queries: [
      'Top markers cluster 0',
      'Top markers cluster 2',
      'Top markers cluster 3',
      'List clusters',
      'Compare cluster 0 and 2',
      'QC summary',
    ],
  },
]

export default function ChatPage() {
  const chatQuery     = useStore(s => s.chatQuery)
  const setActivePlot = useStore(s => s.setActivePlot)
  const sendChatQuery = useStore(s => s.sendChatQuery)

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* Suggested queries sidebar */}
      <div style={{
        width: 220, flexShrink: 0,
        borderRight: '1px solid #1e293b',
        background: '#070b14',
        overflowY: 'auto',
        padding: '16px 12px',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div>
          <p style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 6 }}>
            Try Asking
          </p>
          <button
            onClick={() => sendChatQuery('Help')}
            style={{
              width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 8,
              fontSize: 11, fontWeight: 600, cursor: 'pointer', marginBottom: 10,
              background: 'linear-gradient(135deg, #1e3a8a40, #1e40af20)',
              border: '1px solid #3b82f640', color: '#93c5fd',
            }}
          >
            🤖 Show all capabilities
          </button>
        </div>

        {SUGGESTED_QUERIES.map(section => (
          <div key={section.category}>
            <p style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 6 }}>
              {section.category}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {section.queries.map(q => (
                <button key={q}
                  onClick={() => sendChatQuery(q)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '5px 8px', borderRadius: 6,
                    fontSize: 11, cursor: 'pointer', border: 'none',
                    background: 'transparent', color: '#475569',
                    transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => { e.target.style.background = '#1e293b'; e.target.style.color = '#94a3b8' }}
                  onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = '#475569' }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div style={{ borderTop: '1px solid #1e293b', paddingTop: 12, marginTop: 'auto' }}>
          <p style={{ fontSize: 9, color: '#1e293b', lineHeight: 1.6 }}>
            The AI understands natural language. You can ask biology questions, request plots, 
            or explore the dataset conversationally.
          </p>
        </div>
      </div>

      {/* Chat window */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <ChatWindow
          externalQuery={chatQuery}
          onPlotUpdate={setActivePlot}
        />
      </div>
    </div>
  )
}
