'use client'

/*
 * ChatClient
 *
 * The conversation surface for /v2/chat. Mirrors the legacy /chat
 * page's behavior, restyled for v2 dark chrome and NC voice.
 *
 * Wiring:
 *   - GET /api/chat/history loads prior turns on mount.
 *   - POST /api/chat sends each new user message. The backend already
 *     wires the Three-Layer Context Engine (permanent core + smart
 *     summaries + pgvector retrieval), so this client just shapes the
 *     payload and renders the result.
 *
 * The /api/chat endpoint is JSON, not SSE. We can show the
 * ToolCallIndicator while the request is in flight to keep the
 * surface from feeling frozen during the 20-30s tool-use loop. When
 * the backend grows true streaming we can swap to per-token rendering
 * without touching the bubble layout.
 *
 * "How did I know this?" surfaces the tool-use trace per assistant
 * message via an explanatory sheet, so the user can see which slices
 * of their record the model touched, rather than treating the
 * response as a magic black box.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Sparkles, MessagesSquare, Trash2 } from 'lucide-react'
import ExplainerSheet from '../../_components/ExplainerSheet'
import MessageBubble, { type ChatBubbleMessage } from './MessageBubble'
import ChatInput from './ChatInput'
import ToolCallIndicator from './ToolCallIndicator'
import ChatHistorySheet from './ChatHistorySheet'

const TOOL_LABELS: Record<string, string> = {
  search_daily_logs: 'Daily logs',
  search_symptoms: 'Symptoms',
  get_lab_results: 'Labs',
  get_oura_biometrics: 'Oura',
  get_cycle_data: 'Cycle',
  search_food_entries: 'Food',
  search_pubmed: 'PubMed',
  get_food_nutrients: 'Nutrients',
  check_drug_interactions: 'Drug interactions',
  get_health_profile: 'Health profile',
  get_analysis_findings: 'Analysis',
  get_hypothesis_status: 'Hypotheses',
  get_next_best_actions: 'Next actions',
  get_research_context: 'Research',
}

const STARTERS = [
  "How's my sleep been this week?",
  'Did anything correlate with my last migraine?',
  "What's my cycle pattern showing?",
  'What labs are stale?',
  'How has my pain trended this month?',
  'What foods seem to trigger symptoms?',
]

type RawHistoryRow = {
  id: string
  role: string
  content: string
  tools_used: string[] | null
  created_at: string
}

export default function ChatClient() {
  const searchParams = useSearchParams()
  const [messages, setMessages] = useState<ChatBubbleMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [explainerFor, setExplainerFor] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  // Seed input from ?q= so external links can deep-link a question.
  useEffect(() => {
    const q = searchParams.get('q')
    if (q && input === '') setInput(q)
    // Run once on mount; ignore subsequent input changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load history on mount.
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/chat/history')
        if (!res.ok) return
        const data: { messages?: RawHistoryRow[] } = await res.json()
        if (cancelled || !data.messages) return
        setMessages(
          data.messages.map((m) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            toolsUsed: m.tools_used,
          })),
        )
      } catch {
        // History is nice-to-have; failures are silent.
      } finally {
        if (!cancelled) setHistoryLoaded(true)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading, scrollToBottom])

  const sendMessage = useCallback(
    async (text?: string) => {
      const messageText = (text ?? input).trim()
      if (!messageText || loading) return

      setInput('')
      const userMsg: ChatBubbleMessage = {
        id: `local-${Date.now()}`,
        role: 'user',
        content: messageText,
      }
      setMessages((prev) => [...prev, userMsg])
      setLoading(true)

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: messageText }),
        })

        if (!res.ok) {
          let errorMsg: ChatBubbleMessage
          if (res.status === 401) {
            errorMsg = {
              id: `local-err-${Date.now()}`,
              role: 'assistant',
              content: 'You need to sign in before I can pull your records.',
              errorKind: 'unauth',
            }
          } else if (res.status >= 500) {
            errorMsg = {
              id: `local-err-${Date.now()}`,
              role: 'assistant',
              content: 'Something paused on my end. Try again in a moment.',
              errorKind: 'server',
            }
          } else {
            errorMsg = {
              id: `local-err-${Date.now()}`,
              role: 'assistant',
              content: 'I cannot answer that one right now.',
              errorKind: 'client',
            }
          }
          setMessages((prev) => [...prev, errorMsg])
          return
        }

        const data: { response?: string; toolsUsed?: string[] } = await res.json()
        const assistantMsg: ChatBubbleMessage = {
          id: `local-a-${Date.now()}`,
          role: 'assistant',
          content: data.response ?? '',
          toolsUsed: data.toolsUsed && data.toolsUsed.length > 0 ? data.toolsUsed : null,
        }
        setMessages((prev) => [...prev, assistantMsg])
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `local-err-${Date.now()}`,
            role: 'assistant',
            content: 'Something paused on my end. Try again in a moment.',
            errorKind: 'server',
          },
        ])
      } finally {
        setLoading(false)
      }
    },
    [input, loading],
  )

  const clearHistory = useCallback(async () => {
    // Archive-confirmed delete so we never silently wipe Lanae's
    // chat record. The endpoint requires this exact confirm value.
    try {
      const res = await fetch('/api/chat/history?confirm=archive', { method: 'DELETE' })
      if (res.ok) setMessages([])
    } catch {
      // Silent: clearing is best-effort.
    }
  }, [])

  const showStarters = historyLoaded && messages.length === 0 && !loading

  // Look up the message currently being explained by ID so the
  // sheet survives state updates that change the array index.
  const explainerMessage = useMemo(() => {
    if (!explainerFor) return null
    return messages.find((m) => m.id === explainerFor) ?? null
  }, [explainerFor, messages])

  const jumpTo = useCallback((id: string) => {
    const target = document.querySelector<HTMLElement>(`[data-message-id="${id}"]`)
    if (target && scrollRef.current) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
      }}
    >
      <ConversationToolbar
        onShowHistory={() => setHistoryOpen(true)}
        onClear={clearHistory}
        clearable={messages.length > 0}
      />

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '12px var(--v2-space-3) 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {showStarters && <EmptyState onPick={(s) => sendMessage(s)} />}

        {messages.map((msg) => (
          <div key={msg.id ?? `${msg.role}-${msg.content.slice(0, 16)}`} data-message-id={msg.id}>
            <MessageBubble message={msg} toolLabels={TOOL_LABELS} />
            {msg.role === 'assistant' &&
              msg.toolsUsed &&
              msg.toolsUsed.length > 0 &&
              msg.id && (
                <button
                  type="button"
                  onClick={() => setExplainerFor(msg.id ?? null)}
                  style={{
                    marginTop: 6,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--v2-text-muted)',
                    fontSize: 'var(--v2-text-xs)',
                    cursor: 'pointer',
                    padding: '4px 0',
                    fontWeight: 'var(--v2-weight-medium)',
                    textDecoration: 'underline',
                    textUnderlineOffset: 2,
                  }}
                >
                  How did I know this?
                </button>
              )}
          </div>
        ))}

        {loading && <ToolCallIndicator />}

        <div ref={endRef} />
      </div>

      <ChatInput
        value={input}
        loading={loading}
        onChange={setInput}
        onSubmit={() => sendMessage()}
      />

      <ChatHistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        messages={messages}
        onJumpTo={jumpTo}
      />

      <ExplainerSheet
        open={explainerMessage != null}
        onClose={() => setExplainerFor(null)}
        title="How I answered this"
      >
        <p style={{ margin: 0 }}>
          I pulled from these slices of your record before writing the
          response. Each tool reaches into a different part of the
          Three-Layer Context Engine: permanent identity, smart
          summaries, and per-day vector retrieval.
        </p>
        {explainerMessage?.toolsUsed && explainerMessage.toolsUsed.length > 0 ? (
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: 'none',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
            }}
          >
            {explainerMessage.toolsUsed.map((t) => (
              <li
                key={t}
                style={{
                  fontSize: 'var(--v2-text-xs)',
                  padding: '4px 10px',
                  borderRadius: 'var(--v2-radius-full)',
                  background: 'var(--v2-surface-explanatory-card)',
                  color: 'var(--v2-surface-explanatory-text)',
                  border: '1px solid var(--v2-surface-explanatory-border)',
                  fontWeight: 'var(--v2-weight-medium)',
                }}
              >
                {TOOL_LABELS[t] ?? t}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: 0, color: 'var(--v2-surface-explanatory-muted)' }}>
            No tools were called for this answer; I relied on the
            permanent context already loaded for every chat.
          </p>
        )}
      </ExplainerSheet>
    </div>
  )
}

function ConversationToolbar({
  onShowHistory,
  onClear,
  clearable,
}: {
  onShowHistory: () => void
  onClear: () => void
  clearable: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 'var(--v2-space-2)',
        padding: 'var(--v2-space-2) var(--v2-space-3)',
        borderBottom: '1px solid var(--v2-border-subtle)',
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        onClick={onShowHistory}
        aria-label="Past conversations"
        style={{
          background: 'transparent',
          border: 'none',
          padding: '6px 10px',
          borderRadius: 'var(--v2-radius-sm)',
          color: 'var(--v2-text-secondary)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 'var(--v2-text-xs)',
          fontWeight: 'var(--v2-weight-medium)',
          minHeight: 'var(--v2-touch-target-min)',
        }}
      >
        <MessagesSquare size={14} aria-hidden="true" />
        History
      </button>
      {clearable && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Archive and clear conversation"
          style={{
            background: 'transparent',
            border: 'none',
            padding: '6px 10px',
            borderRadius: 'var(--v2-radius-sm)',
            color: 'var(--v2-text-muted)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 'var(--v2-text-xs)',
            fontWeight: 'var(--v2-weight-medium)',
            minHeight: 'var(--v2-touch-target-min)',
          }}
        >
          <Trash2 size={14} aria-hidden="true" />
          Clear
        </button>
      )}
    </div>
  )
}

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-4)',
        padding: 'var(--v2-space-4) var(--v2-space-2)',
        flex: 1,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-2)',
          alignItems: 'flex-start',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 10px',
            borderRadius: 'var(--v2-radius-full)',
            background: 'var(--v2-accent-primary-soft)',
            color: 'var(--v2-accent-primary)',
            fontSize: 'var(--v2-text-xs)',
            fontWeight: 'var(--v2-weight-semibold)',
            letterSpacing: 'var(--v2-tracking-wide)',
            textTransform: 'uppercase',
          }}
        >
          <Sparkles size={12} aria-hidden="true" />
          Ask AI
        </div>
        <h2
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-xl)',
            fontWeight: 'var(--v2-weight-semibold)',
            color: 'var(--v2-text-primary)',
            lineHeight: 'var(--v2-leading-tight)',
          }}
        >
          Ask anything about your health.
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-secondary)',
            lineHeight: 'var(--v2-leading-relaxed)',
          }}
        >
          I have access to your full record: cycles, sleep, food, symptoms,
          labs, appointments. I will cite what I find and tell you when the
          data is thin.
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-2)',
        }}
      >
        {STARTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            style={{
              textAlign: 'left',
              background: 'var(--v2-bg-card)',
              border: '1px solid var(--v2-border-subtle)',
              borderRadius: 'var(--v2-radius-md)',
              padding: '12px 16px',
              color: 'var(--v2-text-primary)',
              fontSize: 'var(--v2-text-sm)',
              fontWeight: 'var(--v2-weight-medium)',
              cursor: 'pointer',
              minHeight: 'var(--v2-touch-target-min)',
              transition: 'border-color var(--v2-duration-fast) var(--v2-ease-standard), background var(--v2-duration-fast) var(--v2-ease-standard)',
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
