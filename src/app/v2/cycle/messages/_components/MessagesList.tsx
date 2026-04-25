'use client'

/*
 * Renders the inbox list with optimistic dismissal. Each card has
 * a Dismiss button that PATCHes /api/v2/cycle/messages/[id] and
 * removes the row from the local list. Mirrors NC's "Was this
 * message helpful?" footer, but here the only action is dismissal,
 * keeping the surface honest.
 */
import { useState } from 'react'
import { Bell, Droplets, Thermometer, Sparkles, X } from 'lucide-react'
import type { StoredMessage } from '@/lib/cycle/messages-store'
import { Card } from '@/v2/components/primitives'

const KIND_ICON: Record<StoredMessage['kind'], React.ComponentType<{ size?: number }>> = {
  morning_temp_reminder: Thermometer,
  fertile_window_approaching: Bell,
  period_start_predicted: Droplets,
  cycle_insight_ready: Sparkles,
}

export default function MessagesList({ initialMessages }: { initialMessages: StoredMessage[] }) {
  const [messages, setMessages] = useState(initialMessages)

  const dismiss = async (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id))
    try {
      await fetch(`/api/v2/cycle/messages/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dismissed: true }),
      })
    } catch {
      // Best-effort. Next visit reflects server truth.
    }
  }

  if (messages.length === 0) {
    return (
      <p style={{ color: 'var(--v2-text-muted)', fontSize: 'var(--v2-text-sm)' }}>
        Inbox is empty.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
      {messages.map((m) => {
        const Icon = KIND_ICON[m.kind] ?? Bell
        return (
          <Card key={m.id} padding="md">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--v2-space-3)' }}>
                <div
                  style={{
                    flex: '0 0 auto',
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--v2-radius-full)',
                    background: m.dismissed
                      ? 'var(--v2-bg-tile)'
                      : 'rgba(155, 127, 224, 0.18)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: m.dismissed ? 'var(--v2-text-muted)' : 'var(--v2-text-primary)',
                  }}
                  aria-hidden
                >
                  <Icon size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 'var(--v2-text-md)',
                      fontWeight: 'var(--v2-weight-semibold)',
                      color: 'var(--v2-text-primary)',
                      letterSpacing: 'var(--v2-tracking-tight)',
                    }}
                  >
                    {m.title}
                  </h3>
                  <p
                    style={{
                      margin: '4px 0 0',
                      fontSize: 'var(--v2-text-sm)',
                      color: 'var(--v2-text-secondary)',
                      lineHeight: 'var(--v2-leading-relaxed)',
                    }}
                  >
                    {m.body}
                  </p>
                  <div
                    style={{
                      marginTop: 'var(--v2-space-2)',
                      fontSize: 'var(--v2-text-xs)',
                      color: 'var(--v2-text-muted)',
                    }}
                  >
                    {formatRelative(m.created_at)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(m.id)}
                  aria-label="Dismiss message"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--v2-text-muted)',
                    cursor: 'pointer',
                    padding: 4,
                    minHeight: 'var(--v2-touch-target-min)',
                    minWidth: 'var(--v2-touch-target-min)',
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

function formatRelative(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const now = Date.now()
  const diff = now - t
  const minutes = Math.round(diff / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.round(days / 30)
  return `${months}mo ago`
}
