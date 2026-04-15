// ChatWindow.jsx – Gemini-powered conversational AI chat for scRNA-seq analysis
import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api } from '../api.js'

const BACKEND = 'http://127.0.0.1:8000'

function now() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ── Message bubble components ─────────────────────────────────────────────────

function UserBubble({ text, time }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'flex-end', maxWidth: '85%', marginLeft: 'auto' }}>
      <div>
        <div style={{
          background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
          borderRadius: '16px 16px 4px 16px',
          padding: '10px 16px', fontSize: 13, color: '#fff', lineHeight: 1.5,
        }}>
          {text}
        </div>
        <p style={{ fontSize: 9, color: '#334155', textAlign: 'right', marginTop: 3 }}>{time}</p>
      </div>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: '#1e3a8a', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, color: '#93c5fd', fontWeight: 700, marginBottom: 20,
      }}>
        U
      </div>
    </div>
  )
}

function AiBubble({ text, plotUrl, poweredBy, time, isTyping }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', maxWidth: '90%' }}>
      {/* Avatar */}
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg, #1e40af, #7c3aed)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 4,
      }}>
        <span style={{ fontSize: 12 }}>🧬</span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {isTyping ? (
          <div style={{
            background: '#0d1526', border: '1px solid #1e293b', borderRadius: '4px 16px 16px 16px',
            padding: '12px 16px', display: 'flex', gap: 5, alignItems: 'center',
          }}>
            {[0, 0.2, 0.4].map((d, i) => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: '50%', background: '#3b82f6',
                animation: 'bounce 1.2s infinite',
                animationDelay: `${d}s`,
              }} />
            ))}
          </div>
        ) : (
          <>
            <div style={{
              background: '#0d1526', border: '1px solid #1e293b',
              borderRadius: '4px 16px 16px 16px',
              padding: '12px 16px', fontSize: 13, color: '#cbd5e1', lineHeight: 1.7,
            }}
            className="prose-dark">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{text || ''}</ReactMarkdown>
            </div>

            {/* Plot image */}
            {plotUrl && (
              <div style={{ marginTop: 8 }}>
                <img src={plotUrl} alt="Analysis plot"
                  style={{ width: '100%', maxWidth: 580, borderRadius: 10, border: '1px solid #1e293b' }} />
              </div>
            )}

            {/* Footer: time + powered by badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 9, color: '#334155' }}>{time}</span>
              {poweredBy === 'gemini' && (
                <span style={{
                  fontSize: 8, color: '#6366f1', padding: '1px 6px', borderRadius: 4,
                  border: '1px solid #4f46e530', background: '#1e1b4b20', fontWeight: 600,
                  letterSpacing: '0.05em',
                }}>
                  ✦ Gemini 2.5 Flash
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Welcome message ───────────────────────────────────────────────────────────

const WELCOME_TEXT = `👋 **Welcome to CodeCell.ai AI Assistant!**

I'm powered by **Gemini 2.5 Flash** and have full access to your **PBMC 3K dataset** — 2,643 cells, 6 immune cell clusters, and 13,714 genes.

**Ask me anything in plain English:**
- *"What are B cells and why is CD79A their marker?"*
- *"Plot NKG7 on the UMAP"*
- *"Why do monocytes express LYZ?"*
- *"Compare T cells and NK cells"*
- *"Show me the top markers for cluster 2"*
- *"What is the difference between CD4 and CD8 T cells?"*

I can explain biology, generate visualizations, run differential expression, and help you interpret your data. Just ask!`

// ── Main ChatWindow ───────────────────────────────────────────────────────────

export default function ChatWindow({ externalQuery, onPlotUpdate }) {
  const [messages,    setMessages]    = useState([{
    id: 'welcome', role: 'ai', text: WELCOME_TEXT, time: now(), poweredBy: 'gemini',
  }])
  const [input,       setInput]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const [geminiReady, setGeminiReady] = useState(null) // null=checking, true/false
  const bottomRef   = useRef(null)
  const inputRef    = useRef(null)
  const prevExtTs   = useRef(null)

  // Check Gemini status on mount
  useEffect(() => {
    api.chatStatus()
      .then(res => setGeminiReady(res.gemini_available))
      .catch(() => setGeminiReady(false))
  }, [])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Handle external queries from sidebar chips
  useEffect(() => {
    if (externalQuery && externalQuery._ts !== prevExtTs.current) {
      prevExtTs.current = externalQuery._ts
      sendMessage(externalQuery.text)
    }
  }, [externalQuery])

  const sendMessage = async (text) => {
    const userText = (text || input).trim()
    if (!userText || loading) return
    setInput('')

    const userMsg = { id: Date.now(), role: 'user', text: userText, time: now() }

    // Build history for Gemini (exclude welcome message)
    const history = messages
      .filter(m => m.id !== 'welcome')
      .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }))

    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await api.chat(userText, history)

      const aiMsg = {
        id:         Date.now() + 1,
        role:       'ai',
        text:       res.text || '_(no response)_',
        plotUrl:    res.plot_url || null,
        poweredBy:  res.powered_by || 'gemini',
        time:       now(),
      }

      setMessages(prev => [...prev, aiMsg])
      if (res.plot_url && onPlotUpdate) onPlotUpdate(res.plot_url)
    } catch (err) {
      setMessages(prev => [...prev, {
        id:       Date.now() + 1,
        role:     'ai',
        text:     `⚠️ **Connection error:** ${err.message}\n\nMake sure the backend is running at http://127.0.0.1:8000`,
        time:     now(),
        poweredBy: 'builtin',
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => setMessages([{
    id: 'welcome', role: 'ai', text: WELCOME_TEXT, time: now(), poweredBy: 'gemini',
  }])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#070b14' }}>
      {/* Header */}
      <div style={{
        padding: '12px 20px', borderBottom: '1px solid #1e293b',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: '#0a1020', flexShrink: 0,
      }}>
        <div>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>Analysis Chat</h2>
          <p style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>Ask questions in plain English</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Gemini status badge */}
          {geminiReady === true && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 600,
              background: '#1e1b4b30', border: '1px solid #4f46e540', color: '#818cf8',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#818cf8', display: 'inline-block' }} />
              Gemini 2.5 Flash
            </div>
          )}
          {geminiReady === false && (
            <div style={{
              padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 600,
              background: '#1e293b', border: '1px solid #334155', color: '#475569',
            }}>
              Built-in AI
            </div>
          )}
          <button onClick={clearChat} style={{
            fontSize: 10, color: '#475569', padding: '4px 10px',
            border: '1px solid #1e293b', borderRadius: 6, background: 'transparent', cursor: 'pointer',
          }}>
            Clear chat
          </button>
        </div>
      </div>

      {/* Gemini setup prompt if not configured */}
      {geminiReady === false && (
        <div style={{
          background: '#0d1f3a', borderBottom: '1px solid #1e3a8a50',
          padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, color: '#64748b' }}>
            ✦ <strong style={{ color: '#93c5fd' }}>Enable Gemini AI:</strong> Set{' '}
            <code style={{ background: '#1e293b', padding: '1px 5px', borderRadius: 4, color: '#60a5fa' }}>GEMINI_API_KEY</code>{' '}
            in your environment and restart the backend for conversational AI.
            {' '}<a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer"
              style={{ color: '#3b82f6', textDecoration: 'underline', fontSize: 10 }}>
              Get a free key →
            </a>
          </span>
        </div>
      )}

      {/* Message list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 8px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.map(msg => (
          msg.role === 'user'
            ? <UserBubble key={msg.id} text={msg.text} time={msg.time} />
            : <AiBubble   key={msg.id} text={msg.text} plotUrl={msg.plotUrl}
                          poweredBy={msg.poweredBy} time={msg.time} />
        ))}
        {loading && <AiBubble isTyping time="" />}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{
        padding: '12px 16px', borderTop: '1px solid #1e293b',
        background: '#0a1020', flexShrink: 0,
      }}>
        <div style={{
          display: 'flex', gap: 10, alignItems: 'flex-end',
          background: '#0d1526', border: '1px solid #1e293b',
          borderRadius: 14, padding: '8px 8px 8px 16px',
          transition: 'border-color 0.2s',
        }}
        onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'}
        onBlur={e => e.currentTarget.style.borderColor = '#1e293b'}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={geminiReady ? "Ask anything… e.g. Why are B cells in cluster 1? What does GZMA do?" : "Ask anything… e.g. Show UMAP, Plot CD3D, What are B cells?"}
            disabled={loading}
            rows={1}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#e2e8f0', fontSize: 13, lineHeight: 1.5, resize: 'none',
              fontFamily: "'Inter', sans-serif", minHeight: 22, maxHeight: 120,
              overflow: 'auto',
            }}
            onInput={e => {
              e.target.style.height = '22px'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            style={{
              width: 34, height: 34, borderRadius: 10, border: 'none', cursor: 'pointer',
              background: loading || !input.trim() ? '#1e293b' : 'linear-gradient(135deg, #2563eb, #7c3aed)',
              color: loading || !input.trim() ? '#334155' : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s', flexShrink: 0, fontSize: 16,
            }}
          >
            {loading ? '⏳' : '→'}
          </button>
        </div>
        <p style={{ fontSize: 9, color: '#1e293b', textAlign: 'center', marginTop: 6 }}>
          Press <kbd style={{ background: '#1e293b', padding: '1px 5px', borderRadius: 3, color: '#475569' }}>Enter</kbd> to send ·{' '}
          <kbd style={{ background: '#1e293b', padding: '1px 5px', borderRadius: 3, color: '#475569' }}>Shift+Enter</kbd> for new line
        </p>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
        .prose-dark p { margin: 0 0 8px 0; }
        .prose-dark h2, .prose-dark h3 { color: #e2e8f0; margin: 12px 0 6px; font-size: 14px; }
        .prose-dark h2 { font-size: 15px; }
        .prose-dark ul, .prose-dark ol { padding-left: 20px; margin: 6px 0; }
        .prose-dark li { margin: 2px 0; }
        .prose-dark code { background: #1e293b; padding: 1px 5px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #93c5fd; }
        .prose-dark pre { background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; padding: 10px; overflow: auto; }
        .prose-dark table { border-collapse: collapse; width: 100%; font-size: 11px; margin: 8px 0; }
        .prose-dark th { background: #1e293b; color: #94a3b8; padding: 6px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
        .prose-dark td { padding: 5px 10px; border-bottom: 1px solid #1e293b; color: #cbd5e1; }
        .prose-dark tr:hover td { background: #1e293b30; }
        .prose-dark a { color: #60a5fa; text-decoration: underline; }
        .prose-dark strong { color: #e2e8f0; }
        .prose-dark blockquote { border-left: 2px solid #3b82f6; padding-left: 12px; color: #64748b; font-style: italic; margin: 8px 0; }
        .prose-dark hr { border-color: #1e293b; margin: 12px 0; }
      `}</style>
    </div>
  )
}
