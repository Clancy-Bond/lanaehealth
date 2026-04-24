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
 */
import Link from 'next/link'
import type { ReactNode } from 'react'

export type MessageRole = 'user' | 'assistant'
export type MessageErrorKind = 'unauth' | 'client' | 'server'

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

function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} style={{ fontWeight: 'var(--v2-weight-semibold)' }}>
          {part.slice(2, -2)}
        </strong>
      )
    }
    return part
  })
}

function renderMarkdown(text: string): ReactNode[] {
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
            {'\u2022'}
          </span>
          <span>{renderInline(line.slice(2))}</span>
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
          <span>{renderInline(line.slice(numMatch[0].length))}</span>
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
        {renderInline(line)}
      </p>,
    )
  }
  return out
}

export default function MessageBubble({ message, toolLabels = {} }: MessageBubbleProps) {
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
          color: isUser ? 'var(--v2-bg-primary)' : 'var(--v2-text-primary)',
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
        <div>{isUser ? scrubDashes(message.content) : renderMarkdown(message.content)}</div>
        {!isUser && message.errorKind === 'unauth' && (
          <Link
            href="/login?next=/v2/chat"
            style={{
              alignSelf: 'flex-start',
              padding: '6px 12px',
              borderRadius: 'var(--v2-radius-sm)',
              background: 'var(--v2-accent-primary)',
              color: 'var(--v2-bg-primary)',
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
