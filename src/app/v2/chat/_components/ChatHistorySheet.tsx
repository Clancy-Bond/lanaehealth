'use client'

/*
 * ChatHistorySheet
 *
 * Slide-up bottom sheet that lists past conversation turns. The
 * /api/chat/history endpoint returns a flat array of messages, not
 * grouped sessions, so this view groups consecutive user-then-
 * assistant pairs into "turns" and shows the first user prompt as
 * the title with the assistant's first sentence as preview.
 *
 * Tapping a row scrolls the parent conversation view to that turn.
 * It does not branch a new conversation; the chat backend stores a
 * single linear thread.
 */
import { useMemo } from 'react'
import { Sheet } from '@/v2/components/primitives'
import type { ChatBubbleMessage } from './MessageBubble'

interface ChatHistorySheetProps {
  open: boolean
  onClose: () => void
  messages: ChatBubbleMessage[]
  onJumpTo: (id: string) => void
}

interface Turn {
  userId: string
  prompt: string
  preview: string
}

/**
 * Group messages into user-then-assistant turns. Strict pairing
 * (1 user followed by 1 assistant); orphan rows fall through.
 */
function groupTurns(messages: ChatBubbleMessage[]): Turn[] {
  const turns: Turn[] = []
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]
    if (m.role !== 'user' || !m.id) continue
    const next = messages[i + 1]
    const preview =
      next?.role === 'assistant' ? firstSentence(next.content) : ''
    turns.push({
      userId: m.id,
      prompt: m.content,
      preview,
    })
  }
  return turns
}

function firstSentence(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  const dot = cleaned.search(/[.!?](\s|$)/)
  if (dot > 0 && dot < 140) return cleaned.slice(0, dot + 1)
  return cleaned.length > 140 ? cleaned.slice(0, 140) + '...' : cleaned
}

export default function ChatHistorySheet({
  open,
  onClose,
  messages,
  onJumpTo,
}: ChatHistorySheetProps) {
  const turns = useMemo(() => groupTurns(messages), [messages])

  return (
    <Sheet open={open} onClose={onClose} title="Past conversations">
      {turns.length === 0 ? (
        <p
          style={{
            color: 'var(--v2-text-muted)',
            fontSize: 'var(--v2-text-sm)',
            margin: 0,
          }}
        >
          No past turns yet. The first question you ask will appear here.
        </p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-2)',
          }}
        >
          {turns
            .slice()
            .reverse()
            .map((turn) => (
              <li key={turn.userId}>
                <button
                  type="button"
                  onClick={() => {
                    onJumpTo(turn.userId)
                    onClose()
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'var(--v2-bg-card)',
                    border: '1px solid var(--v2-border-subtle)',
                    borderRadius: 'var(--v2-radius-md)',
                    padding: 'var(--v2-space-3) var(--v2-space-4)',
                    color: 'var(--v2-text-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    minHeight: 'var(--v2-touch-target-min)',
                  }}
                >
                  <span
                    style={{
                      fontSize: 'var(--v2-text-sm)',
                      fontWeight: 'var(--v2-weight-semibold)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {turn.prompt}
                  </span>
                  {turn.preview && (
                    <span
                      style={{
                        fontSize: 'var(--v2-text-xs)',
                        color: 'var(--v2-text-muted)',
                        lineHeight: 'var(--v2-leading-normal)',
                      }}
                    >
                      {turn.preview}
                    </span>
                  )}
                </button>
              </li>
            ))}
        </ul>
      )}
    </Sheet>
  )
}
