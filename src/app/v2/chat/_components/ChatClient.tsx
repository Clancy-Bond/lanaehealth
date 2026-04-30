'use client'

/*
 * ChatClient
 *
 * The conversation surface for /v2/chat. Now consumes /api/chat as
 * an SSE stream so the user sees three live phases:
 *
 *   1. Context pull  -> "Reviewing your records (Nk loaded)"
 *   2. Tool calls    -> "Pulling Cycle..."
 *   3. Token stream  -> assistant bubble grows in real time
 *
 * Citations from the `done` event render below the assistant bubble
 * in a collapsible panel; tapping a citation deep-links to the
 * matching v2 surface (cycle, sleep, calories, today). Inline
 * metric chips inside the response open the matching MetricExplainer
 * with the formula the AI used.
 *
 * Architecture notes:
 *   - The SSE consumer is `streamChat` in ./sse-client; it dispatches
 *     events as plain objects so this component stays presentation-
 *     focused.
 *   - "How did I know this?" still opens the existing tools-used
 *     explainer for back-compat with messages loaded from history
 *     (which only have toolsUsed, no live citations).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Sparkles, MessagesSquare, Trash2 } from 'lucide-react'
import ExplainerSheet from '../../_components/ExplainerSheet'
import {
  ReadinessExplainer,
  SleepExplainer,
  CycleExplainer,
} from '../../_components/MetricExplainers'
import MessageBubble, {
  type ChatBubbleMessage,
  type MetricExplainerKey,
} from './MessageBubble'
import ChatInput from './ChatInput'
import ToolCallIndicator, { type ChatPhase } from './ToolCallIndicator'
import ChatHistorySheet from './ChatHistorySheet'
import CitationsPanel, { type ChatCitationView } from './CitationsPanel'
import { streamChat } from './sse-client'

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

/**
 * Maps a `?starter=` query value to a primed user prompt. Keys come
 * from intentional deep-link surfaces (e.g. onboarding StepDone) so
 * we keep the URL contract small and explicit rather than treating
 * the value as free text.
 */
function starterToPrompt(starter: string | null): string | null {
  if (!starter) return null
  switch (starter) {
    case 'summary':
      return 'Give me a summary of my last week.'
    default:
      return null
  }
}

export default function ChatClient() {
  const searchParams = useSearchParams()
  const [messages, setMessages] = useState<ChatBubbleMessage[]>([])
  // Citations are kept off the message itself so older history rows
  // (which never had citations) stay structurally identical.
  const [citationsByMessageId, setCitationsByMessageId] = useState<
    Record<string, ChatCitationView[]>
  >({})
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [explainerFor, setExplainerFor] = useState<string | null>(null)

  // Live SSE state. `streamingId` is the id of the assistant bubble
  // currently being populated by deltas; null when idle.
  const [phase, setPhase] = useState<ChatPhase | null>(null)
  const [currentTool, setCurrentTool] = useState<string | null>(null)
  const [contextTokens, setContextTokens] = useState<number | null>(null)
  const [streamingId, setStreamingId] = useState<string | null>(null)

  // Inline metric formula explainer dispatched from MessageBubble chips.
  const [metricExplainer, setMetricExplainer] = useState<MetricExplainerKey | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Seed input from ?q= so external links can deep-link a question.
  // Onboarding's StepDone links to ?starter=summary; map well-known
  // starter keys to a primed prompt so the deep link actually lands.
  useEffect(() => {
    const q = searchParams.get('q')
    const starter = searchParams.get('starter')
    const seed = q ?? starterToPrompt(starter)
    if (seed && input === '') setInput(seed)
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
      abortRef.current?.abort()
    }
  }, [])

  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading, scrollToBottom])

  const handleExplainMetric = useCallback((key: MetricExplainerKey) => {
    setMetricExplainer(key)
  }, [])

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
      // Pre-create the assistant bubble so token deltas have a
      // place to land as they arrive.
      const assistantId = `local-a-${Date.now()}`
      const assistantSeed: ChatBubbleMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        toolsUsed: null,
      }
      setMessages((prev) => [...prev, userMsg, assistantSeed])
      setStreamingId(assistantId)
      setPhase('connecting')
      setCurrentTool(null)
      setContextTokens(null)
      setLoading(true)

      const controller = new AbortController()
      abortRef.current = controller
      const liveTools: string[] = []
      let liveCitations: ChatCitationView[] = []

      try {
        await streamChat({
          message: messageText,
          signal: controller.signal,
          onEvent: (event) => {
            switch (event.type) {
              case 'context': {
                setPhase('context')
                setContextTokens(event.tokenEstimate)
                liveCitations = event.citations
                break
              }
              case 'tool': {
                setPhase('tool')
                setCurrentTool(event.name)
                if (!liveTools.includes(event.name)) {
                  liveTools.push(event.name)
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId ? { ...m, toolsUsed: [...liveTools] } : m,
                    ),
                  )
                }
                break
              }
              case 'token': {
                setPhase('streaming')
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: m.content + event.delta } : m,
                  ),
                )
                break
              }
              case 'done': {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          content: event.full_response || m.content,
                          toolsUsed: event.toolsUsed.length > 0 ? event.toolsUsed : null,
                        }
                      : m,
                  ),
                )
                setCitationsByMessageId((prev) => ({
                  ...prev,
                  [assistantId]: event.citations,
                }))
                break
              }
              case 'error': {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          content: m.content || 'Something paused on my end. Try again in a moment.',
                          errorKind: 'server',
                        }
                      : m,
                  ),
                )
                break
              }
            }
          },
        })

        // If the stream closed without a `done` we still want
        // citations attached so the panel renders.
        setCitationsByMessageId((prev) => {
          if (prev[assistantId]) return prev
          return { ...prev, [assistantId]: liveCitations }
        })
      } catch (err: unknown) {
        const aborted = err instanceof DOMException && err.name === 'AbortError'
        if (aborted) return
        const status = (err as { status?: number } | null)?.status
        let errorMsg: ChatBubbleMessage
        if (status === 401) {
          errorMsg = {
            id: assistantId,
            role: 'assistant',
            content: 'You need to sign in before I can pull your records.',
            errorKind: 'unauth',
          }
        } else if (status && status >= 500) {
          errorMsg = {
            id: assistantId,
            role: 'assistant',
            content: 'Something paused on my end. Try again in a moment.',
            errorKind: 'server',
          }
        } else if (status) {
          errorMsg = {
            id: assistantId,
            role: 'assistant',
            content: 'I cannot answer that one right now.',
            errorKind: 'client',
          }
        } else {
          errorMsg = {
            id: assistantId,
            role: 'assistant',
            content: 'Something paused on my end. Try again in a moment.',
            errorKind: 'server',
          }
        }
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? errorMsg : m)))
      } finally {
        setLoading(false)
        setPhase(null)
        setCurrentTool(null)
        setContextTokens(null)
        setStreamingId(null)
        abortRef.current = null
      }
    },
    [input, loading],
  )

  const clearHistory = useCallback(async () => {
    // Archive-confirmed delete so we never silently wipe Lanae's
    // chat record. The endpoint requires this exact confirm value.
    try {
      const res = await fetch('/api/chat/history?confirm=archive', { method: 'DELETE' })
      if (res.ok) {
        setMessages([])
        setCitationsByMessageId({})
      }
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

        {messages.map((msg) => {
          const isStreaming = msg.id === streamingId
          const cites = msg.id ? citationsByMessageId[msg.id] : undefined
          return (
            <div key={msg.id ?? `${msg.role}-${msg.content.slice(0, 16)}`} data-message-id={msg.id}>
              <MessageBubble
                message={msg}
                toolLabels={TOOL_LABELS}
                onExplainMetric={msg.role === 'assistant' ? handleExplainMetric : undefined}
              />
              {msg.role === 'assistant' && cites && cites.length > 0 && (
                <CitationsPanel citations={cites} />
              )}
              {msg.role === 'assistant' &&
                !isStreaming &&
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
          )
        })}

        {loading && phase !== 'streaming' && (
          <ToolCallIndicator
            phase={phase ?? 'connecting'}
            currentTool={currentTool}
            contextTokenEstimate={contextTokens}
          />
        )}

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

      {/* Inline metric formula explainers dispatched from chat chips.
          These are read-only formulas (no live values), so we show
          them with no current value plotted. */}
      <ReadinessExplainer
        open={metricExplainer === 'readiness'}
        onClose={() => setMetricExplainer(null)}
        value={null}
        dateISO={null}
      />
      <SleepExplainer
        open={metricExplainer === 'sleep_score'}
        onClose={() => setMetricExplainer(null)}
        score={null}
        durationSeconds={null}
        dateISO={null}
      />
      <CycleExplainer
        open={metricExplainer === 'cover_line' || metricExplainer === 'fertility_status' || metricExplainer === 'bbt'}
        onClose={() => setMetricExplainer(null)}
        day={null}
        phase={null}
        isUnusuallyLong={null}
        lastPeriodISO={null}
      />
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
          title="Archives your conversation. The record is kept; the screen clears."
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
          Archive
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
