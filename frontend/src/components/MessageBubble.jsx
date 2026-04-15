// MessageBubble.jsx – Renders a single chat message (user or AI)
// Supports: text, plot image, markdown table, error, and typing indicator
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// ─── Typing indicator ────────────────────────────────────────────────────────
export function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 animate-slide-up">
      <AvatarAI />
      <div className="message-ai flex items-center gap-1.5 py-3 px-4">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  )
}

// ─── Avatars ─────────────────────────────────────────────────────────────────
function AvatarAI() {
  return (
    <div className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-glow-sm mb-0.5">
      <span className="text-[10px] font-bold text-white">AI</span>
    </div>
  )
}

function AvatarUser() {
  return (
    <div className="w-7 h-7 shrink-0 rounded-full bg-surface-500 border border-white/10 flex items-center justify-center mb-0.5">
      <svg className="w-3.5 h-3.5 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
      </svg>
    </div>
  )
}

// ─── Timestamp ────────────────────────────────────────────────────────────────
function Timestamp({ time }) {
  return (
    <span className="text-[10px] text-slate-600 mt-1 px-1">
      {time}
    </span>
  )
}

// ─── MessageBubble ────────────────────────────────────────────────────────────
export default function MessageBubble({ msg }) {
  const { role, type, content, time, plotTitle } = msg

  // ── User message ──────────────────────────────────────────────────────────
  if (role === 'user') {
    return (
      <div className="flex items-end justify-end gap-2 animate-slide-up">
        <div className="flex flex-col items-end">
          <div className="message-user">{content}</div>
          <Timestamp time={time} />
        </div>
        <AvatarUser />
      </div>
    )
  }

  // ── AI messages ───────────────────────────────────────────────────────────
  return (
    <div className="flex items-end gap-2 animate-slide-up">
      <AvatarAI />
      <div className="flex flex-col items-start max-w-[90%]">

        {/* Plot response */}
        {type === 'plot' && (
          <div className="message-ai p-2 w-full">
            <p className="text-[10px] text-brand-300 font-medium mb-2 px-1">📊 {plotTitle || 'Visualization'}</p>
            <img
              src={content}
              alt={plotTitle || 'plot'}
              className="plot-img rounded-xl cursor-zoom-in"
              onClick={() => window.open(content, '_blank')}
            />
            <p className="text-[10px] text-slate-500 mt-2 px-1">Click to open full size</p>
          </div>
        )}

        {/* Text / Markdown response */}
        {type === 'text' && (
          <div className="message-ai prose-dark">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}

        {/* Table / Marker genes response */}
        {type === 'table' && (
          <div className="message-ai prose-dark w-full overflow-x-auto">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}

        {/* Error response */}
        {type === 'error' && (
          <div className="message-ai border-red-500/30 bg-red-900/20 text-red-300">
            <span className="text-red-400 mr-1">⚠️</span>{content}
          </div>
        )}

        <Timestamp time={time} />
      </div>
    </div>
  )
}
