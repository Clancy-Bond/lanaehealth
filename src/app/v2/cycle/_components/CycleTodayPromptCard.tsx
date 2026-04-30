'use client'

/*
 * Today-screen smart-prompt card.
 *
 * Closes Tier 2 of docs/research/cycle-nc-substantive-gaps.md: NC
 * surfaces phase-aware reminders ("Time to take an ovulation test,"
 * "Your period is coming soon") AS today-screen cards, not just inbox
 * items. We had the inbox surface at /v2/cycle/messages for asynchronous
 * reading, but the cards never appeared on the today screen, where the
 * user actually looks. Burying the prompt loses 90% of its value.
 *
 * The component takes the highest-priority undismissed message and
 * renders a single card above the period prediction. A dismiss X
 * removes the card optimistically and PATCHes the same endpoint the
 * inbox uses, so the bell badge count stays accurate.
 *
 * The "View all" link routes to /v2/cycle/messages so the user can see
 * older / lower-priority prompts without us cluttering the today screen.
 */
import { useState } from 'react'
import Link from 'next/link'
import {
  Bell,
  ChevronRight,
  Droplets,
  Sparkles,
  Thermometer,
  X,
} from 'lucide-react'
import type { StoredMessage } from '@/lib/cycle/messages-store'
import { Card } from '@/v2/components/primitives'

const KIND_ICON: Record<StoredMessage['kind'], React.ComponentType<{ size?: number }>> = {
  morning_temp_reminder: Thermometer,
  fertile_window_approaching: Bell,
  period_start_predicted: Droplets,
  cycle_insight_ready: Sparkles,
}

const KIND_TONE: Record<StoredMessage['kind'], string> = {
  morning_temp_reminder: 'rgba(77, 184, 168, 0.16)',
  fertile_window_approaching: 'rgba(229, 201, 82, 0.18)',
  period_start_predicted: 'rgba(232, 99, 119, 0.16)',
  cycle_insight_ready: 'rgba(155, 127, 224, 0.16)',
}

export interface CycleTodayPromptCardProps {
  /** The highest-priority undismissed message, or null when the inbox is empty. */
  message: StoredMessage | null
}

export default function CycleTodayPromptCard({ message }: CycleTodayPromptCardProps) {
  const [dismissed, setDismissed] = useState(false)

  if (!message || dismissed) return null

  const Icon = KIND_ICON[message.kind] ?? Bell

  const dismiss = async () => {
    // Optimistic. The PATCH endpoint is best-effort; on failure the
    // inbox view shows the source of truth on the next visit.
    setDismissed(true)
    try {
      await fetch(`/api/v2/cycle/messages/${message.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dismissed: true }),
      })
    } catch {
      // best-effort
    }
  }

  return (
    <Card padding="md">
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--v2-space-3)',
        }}
      >
        <div
          aria-hidden
          style={{
            flex: '0 0 auto',
            width: 32,
            height: 32,
            borderRadius: 'var(--v2-radius-full)',
            background: KIND_TONE[message.kind] ?? 'var(--v2-bg-tile)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--v2-text-primary)',
          }}
        >
          <Icon size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 'var(--v2-space-2)',
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-md)',
                fontWeight: 'var(--v2-weight-semibold)',
                color: 'var(--v2-text-primary)',
                letterSpacing: 'var(--v2-tracking-tight)',
              }}
            >
              {message.title}
            </h3>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={dismiss}
              style={{
                flex: '0 0 auto',
                background: 'transparent',
                border: 'none',
                padding: 4,
                margin: 0,
                cursor: 'pointer',
                color: 'var(--v2-text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 'var(--v2-touch-target-min)',
                minHeight: 'var(--v2-touch-target-min)',
              }}
            >
              <X size={16} />
            </button>
          </div>
          <p
            style={{
              margin: 'var(--v2-space-1) 0 0',
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            {message.body}
          </p>
          <Link
            href="/v2/cycle/messages"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              marginTop: 'var(--v2-space-2)',
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
              textDecoration: 'none',
              fontWeight: 'var(--v2-weight-medium)',
            }}
          >
            View all
            <ChevronRight size={12} aria-hidden />
          </Link>
        </div>
      </div>
    </Card>
  )
}
