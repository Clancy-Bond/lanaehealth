'use client'

/**
 * NutritionCoachChat
 *
 * Scoped chat UI for the AI nutrition coach. Posts to
 * `/api/chat/nutrition-coach`, renders the back-and-forth inline, and
 * honors the non-shaming voice rule at the UI layer (no streak celebration
 * on send, no empty-state shame copy on idle).
 *
 * The component does NOT mount itself into `/log/page.tsx`. Per the
 * Wave 2c brief, mounting is deferred when the log page is contested;
 * callers that DO want to mount can import this and pass it into the
 * existing log layout themselves.
 *
 * Scope boundary: this component is nutrition-only. Non-nutrition
 * questions are handled by the persona prompt server-side, but we also
 * show a small inline hint when the user phrases a question that clearly
 * sits outside nutrition, so they can redirect without spending tokens.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { looksNutritionRelevant } from '@/lib/personas/nutrition-coach'

// ── Types ──────────────────────────────────────────────────────────────

interface CoachMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface NutritionCoachChatProps {
  /** Optional seed question that pre-fills the input on mount. */
  initialQuestion?: string
  /** Optional heading override. Defaults to "Nutrition coach". */
  heading?: string
  /** Max visible height in px (chat scrolls inside). */
  maxHeight?: number
}

// ── Starter prompts ────────────────────────────────────────────────────
//
// These are framed as observations/questions, never prescriptions.
const STARTERS: readonly string[] = [
  'What patterns do you see in my last week of meals?',
  'Am I tracking low on any nutrient targets today?',
  'Are there iron-rich foods I already eat that I could lean on?',
  'How does my hydration compare to a typical POTS recommendation?',
]

// ── Small utilities ────────────────────────────────────────────────────

function scrubDashes(input: string): string {
  // Project-wide em-dash ban. Render-time scrub so the rule holds even
  // when Claude sends one through.
  return input.replace(/\s*[\u2013\u2014]\s*/g, ', ')
}

function renderInline(text: string): React.ReactNode {
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g)
  return boldParts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} style={{ fontWeight: 600 }}>
          {part.slice(2, -2)}
        </strong>
      )
    }
    return part
  })
}

function formatMessage(text: string): React.ReactNode[] {
  const lines = scrubDashes(text).split('\n')
  const nodes: React.ReactNode[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('### ')) {
      nodes.push(
        <h4
          key={i}
          style={{ fontSize: 13, fontWeight: 700, margin: '10px 0 4px' }}
        >
          {line.slice(4)}
        </h4>,
      )
      continue
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      nodes.push(
        <div key={i} style={{ display: 'flex', gap: 6, paddingLeft: 4 }}>
          <span style={{ color: '#6B9080', fontWeight: 700 }}>{'\u2022'}</span>
          <span>{renderInline(line.slice(2))}</span>
        </div>,
      )
      continue
    }
    if (line.trim() === '') {
      nodes.push(<div key={i} style={{ height: 6 }} />)
      continue
    }
    nodes.push(
      <p key={i} style={{ margin: '2px 0' }}>
        {renderInline(line)}
      </p>,
    )
  }
  return nodes
}

// ── Component ──────────────────────────────────────────────────────────

export default function NutritionCoachChat({
  initialQuestion = '',
  heading = 'Nutrition coach',
  maxHeight = 520,
}: NutritionCoachChatProps) {
  const [messages, setMessages] = useState<CoachMessage[]>([])
  const [input, setInput] = useState(initialQuestion)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading, scrollToBottom])

  const sendMessage = useCallback(
    async (text?: string) => {
      const msg = (text ?? input).trim()
      if (!msg || loading) return

      setError(null)
      setInput('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'

      setMessages((prev) => [...prev, { role: 'user', content: msg }])
      setLoading(true)

      try {
        const res = await fetch('/api/chat/nutrition-coach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msg }),
        })

        if (!res.ok) {
          const j = await res.json().catch(() => ({ error: 'Request failed' }))
          throw new Error(j.error || 'Request failed')
        }

        const data = (await res.json()) as { response: string }
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.response || '(no response)' },
        ])
      } catch (err) {
        // Non-shaming failure copy. No "something went wrong" guilt.
        setError(
          err instanceof Error
            ? err.message
            : 'Could not reach the coach. Try again in a moment.',
        )
      } finally {
        setLoading(false)
      }
    },
    [input, loading],
  )

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 96) + 'px'
  }

  const offTopicHint =
    input.trim().length > 12 && !looksNutritionRelevant(input)

  return (
    <section
      aria-label={heading}
      style={{
        background: '#FAFAF7',
        border: '1px solid rgba(107, 144, 128, 0.2)',
        borderRadius: 16,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#3a3a3a' }}>
          {heading}
        </h3>
        <span style={{ fontSize: 11, color: '#7a7a7a' }}>
          observation, not diagnosis
        </span>
      </header>

      {/* Message list */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          maxHeight,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: '4px 2px',
        }}
      >
        {messages.length === 0 && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ margin: 0, fontSize: 13, color: '#6a6a6a' }}>
              Ask about your own meal patterns, nutrient targets, or
              cycle-aware nutrition. No pressure, just facts when you want them.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => sendMessage(s)}
                  style={{
                    textAlign: 'left',
                    background: 'white',
                    border: '1px solid rgba(107, 144, 128, 0.2)',
                    borderRadius: 10,
                    padding: '8px 10px',
                    fontSize: 13,
                    cursor: 'pointer',
                    color: '#3a3a3a',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: m.role === 'user' ? '85%' : '92%',
                background: m.role === 'user' ? '#6B9080' : 'white',
                color: m.role === 'user' ? 'white' : '#3a3a3a',
                border:
                  m.role === 'user'
                    ? 'none'
                    : '1px solid rgba(107, 144, 128, 0.15)',
                borderRadius:
                  m.role === 'user'
                    ? '14px 14px 4px 14px'
                    : '14px 14px 14px 4px',
                padding: m.role === 'user' ? '8px 12px' : '10px 12px',
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {m.role === 'assistant' ? formatMessage(m.content) : m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div
            style={{
              alignSelf: 'flex-start',
              background: 'white',
              border: '1px solid rgba(107, 144, 128, 0.15)',
              borderRadius: '14px 14px 14px 4px',
              padding: '10px 14px',
              fontSize: 12,
              color: '#7a7a7a',
            }}
          >
            thinking...
          </div>
        )}
      </div>

      {/* Scope hint */}
      {offTopicHint && (
        <div
          role="status"
          style={{
            fontSize: 12,
            color: '#7a7a7a',
            background: '#F5F1ED',
            border: '1px solid rgba(107, 144, 128, 0.15)',
            borderRadius: 10,
            padding: '6px 10px',
          }}
        >
          That looks broader than nutrition. The coach can still try, or you
          can ask it in the main AI chat instead.
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            fontSize: 12,
            color: '#8a4a4a',
            background: '#F7ECEC',
            border: '1px solid rgba(212, 160, 160, 0.4)',
            borderRadius: 10,
            padding: '6px 10px',
          }}
        >
          {error}
        </div>
      )}

      {/* Input */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 8,
          background: 'white',
          border: '1px solid rgba(107, 144, 128, 0.2)',
          borderRadius: 16,
          padding: '6px 6px 6px 12px',
        }}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKey}
          placeholder="Ask about your nutrition"
          disabled={loading}
          rows={1}
          aria-label="Ask the nutrition coach"
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            resize: 'none',
            background: 'transparent',
            fontSize: 13,
            lineHeight: 1.4,
            padding: '6px 0',
            maxHeight: 96,
            fontFamily: 'inherit',
            color: '#3a3a3a',
          }}
        />
        <button
          type="button"
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          aria-label="Send question"
          style={{
            minWidth: 56,
            height: 32,
            borderRadius: 16,
            border: 'none',
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            background:
              loading || !input.trim() ? '#E5E3DD' : '#6B9080',
            color: loading || !input.trim() ? '#9a9a9a' : 'white',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Ask
        </button>
      </div>
    </section>
  )
}
