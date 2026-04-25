'use client'

/*
 * MessageBubble
 *
 * Single conversation bubble. User messages right-aligned with the
 * teal accent fill. Assistant messages left-aligned over a dark
 * card surface with a hairline border. NC voice in the assistant
 * styling: short, kind, plenty of breathing room.
 *
 * Markdown-lite rendering supports headers, bullets, numbered lists,
 * and inline bold. Em and en dashes are scrubbed defensively at
 * render time so the repo-wide dash ban (CLAUDE.md) holds even when
 * the LLM emits dashes the back end did not strip.
 *
 * Inline metric chips: when the assistant mentions a known derived
 * metric (readiness, sleep score, cover line, fertility status, BBT
 * trend), we wrap the phrase in a tiny "?" chip that opens the
 * matching MetricExplainer sheet. Backstop for the formula directive
 * in chat-system-prompt: even when Claude forgets to explain, the
 * user can tap the chip and read the formula.
 */
import Link from 'next/link'
import type { MouseEvent, ReactNode } from 'react'

export type MessageRole = 'user' | 'assistant'
export type MessageErrorKind = 'unauth' | 'client' | 'server'
export type MetricExplainerKey =
  | 'readiness'
  | 'sleep_score'
  | 'cover_line'
  | 'fertility_status'
  | 'bbt'

export interface ChatBubbleMessage {
  id?: string
  role: MessageRole
  content: string
  toolsUsed?: string[] | null
  errorKind?: MessageErrorKind
}

interface MessageBubbleProps {
  message: ChatBubbleMessage
  /** Render the assistant's tools-used pill row beneath the bubble. */
  toolLabels?: Record<string, string>
  /** Tap an inline metric chip to open its formula explainer. */
  onExplainMetric?: (key: MetricExplainerKey) => void
}

/**
 * Defensive dash scrubber. Em (U+2014) and en (U+2013) dashes are
 * banned across the codebase. The LLM still emits them; replacing
 * with a comma at render time keeps the rule honored on screen.
 * Hyphens (U+002D) stay because they appear in legitimate ranges.
 */
function scrubDashes(input: string): string {
  return input.replace(/\s*[\u2013\u2014]\s*/g, ', ')
}

// Top 5 metrics the user can tap-to-formula in chat. Patterns are
// case-insensitive and match the natural phrasing Claude tends to
// emit. Order matters: longer specific phrases first so "sleep
// score" beats a substring match on "sleep".
const METRIC_PATTERNS: Array<{ key: MetricExplainerKey; rx: RegExp }> = [
  { key: 'sleep_score', rx: /\b(sleep score)\b/i },
  { key: 'readiness', rx: /\b(readiness(?:\s+score)?)\b/i },
  { key: 'cover_line', rx: /\b(cover line)\b/i },
  { key: 'fertility_status', rx: /\b(fertility status|fertility window)\b/i },
  { key: 'bbt', rx: /\b(BBT(?:\s+trend)?|basal body temperature)\b/i },
]

function MetricChip({
  metric,
  label,
  onExplain,
}: {
  metric: MetricExplainerKey
  label: string
  onExplain: (k: MetricExplainerKey) => void
}) {
  const handle = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    onExplain(metric)
  }
  return (
    <button
      type="button"
      onClick={handle}
      data-metric-chip={metric}
      aria-label={`Explain ${label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 4,
        padding: '0 6px',
        marginLeft: 1,
        marginRight: 1,
        background: 'var(--v2-accent-primary-soft)',
        color: 'var(--v2-accent-primary)',
        border: '1px solid var(--v2-accent-primary-soft)',
        borderRadius: 'var(--v2-radius-full)',
        fontSize: 'inherit',
        fontWeight: 'var(--v2-weight-medium)',
        lineHeight: 'inherit',
        cursor: 'pointer',
        font: 'inherit',
      }}
    >
      <span style={{ font: 'inherit' }}>{label}</span>
      <span
        aria-hidden="true"
        style={{
          fontSize: 'var(--v2-text-xs)',
          opacity: 0.85,
          fontWeight: 'var(--v2-weight-bold)',
        }}
      >
        ?
      </span>
    </button>
  )
}

/**
 * Walks a string and replaces the first occurrence of each known
 * metric pattern with a `MetricChip`. Returns a `ReactNode[]` so it
 * can be embedded inside any inline rendering pass.
 */
function withMetricChips(
  text: string,
  onExplainMetric: ((k: MetricExplainerKey) => void) | undefined,
): ReactNode[] {
  if (!onExplainMetric) return [text]

  type Hit = { start: number; end: number; key: MetricExplainerKey; label: string }
  const hits: Hit[] = []
  for (const { key, rx } of METRIC_PATTERNS) {
    const m = rx.exec(text)
    if (!m) continue
    hits.push({ start: m.index, end: m.index + m[1].length, key, label: m[1] })
  }
  if (hits.length === 0) return [text]

  // Sort hits by position; if two patterns overlap (rare), keep the
  // earlier one so we never emit overlapping chips.
  hits.sort((a, b) => a.start - b.start)
  const filtered: Hit[] = []
  let cursor = -1
  for (const h of hits) {
    if (h.start >= cursor) {
      filtered.push(h)
      cursor = h.end
    }
  }

  const out: ReactNode[] = []
  let pos = 0
  filtered.forEach((h, i) => {
    if (h.start > pos) out.push(text.slice(pos, h.start))
    out.push(
      <MetricChip
        key={`chip-${h.key}-${i}`}
        metric={h.key}
        label={h.label}
        onExplain={onExplainMetric}
      />,
    )
    pos = h.end
  })
  if (pos < text.length) out.push(text.slice(pos))
  return out
}

function renderInline(
  text: string,
  onExplainMetric: ((k: MetricExplainerKey) => void) | undefined,
): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} style={{ fontWeight: 'var(--v2-weight-semibold)' }}>
          {withMetricChips(part.slice(2, -2), onExplainMetric)}
        </strong>
      )
    }
    return (
      <span key={i} style={{ font: 'inherit' }}>
        {withMetricChips(part, onExplainMetric)}
      </span>
    )
  })
}

function renderMarkdown(
  text: string,
  onExplainMetric: ((k: MetricExplainerKey) => void) | undefined,
): ReactNode[] {
  const lines = scrubDashes(text).split('\n')
  const out: ReactNode[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('### ')) {
      out.push(
        <h4
          key={i}
          style={{
            fontSize: 'var(--v2-text-sm)',
            fontWeight: 'var(--v2-weight-bold)',
            margin: '12px 0 4px',
            color: 'var(--v2-text-primary)',
          }}
        >
          {line.slice(4)}
        </h4>,
      )
      continue
    }
    if (line.startsWith('## ')) {
      out.push(
        <h3
          key={i}
          style={{
            fontSize: 'var(--v2-text-base)',
            fontWeight: 'var(--v2-weight-bold)',
            margin: '14px 0 4px',
            color: 'var(--v2-text-primary)',
          }}
        >
          {line.slice(3)}
        </h3>,
      )
      continue
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      out.push(
        <div
          key={i}
          style={{
            display: 'flex',
            gap: 6,
            paddingLeft: 4,
            marginTop: 2,
          }}
        >
          <span style={{ color: 'var(--v2-accent-primary)', fontWeight: 'var(--v2-weight-bold)', flexShrink: 0 }}>
            {'•'}
          </span>
          <span>{renderInline(line.slice(2), onExplainMetric)}</span>
        </div>,
      )
      continue
    }
    const numMatch = line.match(/^(\d+)\.\s/)
    if (numMatch) {
      out.push(
        <div
          key={i}
          style={{
            display: 'flex',
            gap: 6,
            paddingLeft: 4,
            marginTop: 2,
          }}
        >
          <span
            style={{
              color: 'var(--v2-accent-primary)',
              fontWeight: 'var(--v2-weight-semibold)',
              flexShrink: 0,
              minWidth: 18,
            }}
          >
            {numMatch[1]}.
          </span>
          <span>{renderInline(line.slice(numMatch[0].length), onExplainMetric)}</span>
        </div>,
      )
      continue
    }
    if (line.trim() === '') {
      out.push(<div key={i} style={{ height: 8 }} />)
      continue
    }
    out.push(
      <p key={i} style={{ margin: '2px 0' }}>
        {renderInline(line, onExplainMetric)}
      </p>,
    )
  }
  return out
}

export default function MessageBubble({
  message,
  toolLabels = {},
  onExplainMetric,
}: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        gap: 4,
      }}
    >
      <div
        style={{
          maxWidth: isUser ? '85%' : '94%',
          padding: isUser ? '10px 14px' : '12px 16px',
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          background: isUser ? 'var(--v2-accent-primary)' : 'var(--v2-bg-card)',
          color: isUser ? 'var(--v2-on-accent)' : 'var(--v2-text-primary)',
          fontSize: 'var(--v2-text-base)',
          lineHeight: 'var(--v2-leading-normal)',
          border: isUser ? 'none' : '1px solid var(--v2-border-subtle)',
          boxShadow: 'var(--v2-shadow-sm)',
          wordBreak: 'break-word',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div>
          {isUser
            ? scrubDashes(message.content)
            : renderMarkdown(message.content, onExplainMetric)}
        </div>
        {!isUser && message.errorKind === 'unauth' && (
          <Link
            href="/login?next=/v2/chat"
            style={{
              alignSelf: 'flex-start',
              padding: '6px 12px',
              borderRadius: 'var(--v2-radius-sm)',
              background: 'var(--v2-accent-primary)',
              color: 'var(--v2-on-accent)',
              fontSize: 'var(--v2-text-sm)',
              fontWeight: 'var(--v2-weight-semibold)',
              textDecoration: 'none',
            }}
          >
            Take me to login
          </Link>
        )}
      </div>

      {!isUser && message.toolsUsed && message.toolsUsed.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            paddingLeft: 4,
          }}
        >
          {message.toolsUsed.map((tool) => (
            <span
              key={tool}
              style={{
                fontSize: 'var(--v2-text-xs)',
                padding: '2px 8px',
                borderRadius: 'var(--v2-radius-full)',
                background: 'var(--v2-accent-primary-soft)',
                color: 'var(--v2-accent-primary)',
                fontWeight: 'var(--v2-weight-medium)',
              }}
            >
              {toolLabels[tool] ?? tool}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
