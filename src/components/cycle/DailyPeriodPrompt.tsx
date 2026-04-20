'use client'

/**
 * One-tap "did your period come today?" prompt.
 *
 * Shown on /cycle landing. Three choices (yes with one-tap save, no with
 * explicit noop, open full form). On "yes", we mark menstruation = true
 * via /api/cycle/log and refresh. Voice rule: no shame if they skip.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Droplet } from 'lucide-react'

export interface DailyPeriodPromptProps {
  /** ISO date this prompt is for. */
  date: string
  /** Current state of the entry for this date, if any. */
  initialMenstruation: boolean
}

export function DailyPeriodPrompt({ date, initialMenstruation }: DailyPeriodPromptProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirmed, setConfirmed] = useState(initialMenstruation)
  const [error, setError] = useState<string | null>(null)

  const onYes = () => {
    setError(null)
    startTransition(async () => {
      const res = await fetch('/api/cycle/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, menstruation: true, flow_level: 'medium' }),
      })
      if (!res.ok) {
        setError('Could not save. Try again.')
        return
      }
      setConfirmed(true)
      router.refresh()
    })
  }

  return (
    <section
      className="card"
      style={{
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Droplet size={18} style={{ color: 'var(--phase-menstrual)' }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
          Period today?
        </div>
      </div>

      <p style={{ fontSize: 13, margin: 0, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
        {confirmed
          ? 'Logged as a menstrual day. Tap the full form if you want to record flow, clots, or symptoms.'
          : 'One tap records today as a menstrual day. Skip if not applicable.'}
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onYes}
          disabled={pending || confirmed}
          className="press-feedback"
          style={{
            flex: '1 1 120px',
            minHeight: 44,
            padding: '10px 14px',
            borderRadius: 10,
            background: confirmed ? 'var(--accent-sage)' : 'var(--phase-menstrual)',
            color: 'var(--text-inverse)',
            fontSize: 13,
            fontWeight: 700,
            border: 'none',
            cursor: pending || confirmed ? 'default' : 'pointer',
            opacity: pending ? 0.7 : 1,
            letterSpacing: '0.02em',
          }}
        >
          {confirmed ? 'Logged' : pending ? 'Saving...' : 'Yes, log it'}
        </button>
        <Link
          href={`/cycle/log?date=${date}`}
          className="press-feedback"
          style={{
            flex: '1 1 120px',
            minHeight: 44,
            padding: '10px 14px',
            borderRadius: 10,
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            fontSize: 13,
            fontWeight: 700,
            border: '1px solid var(--border-light)',
            textDecoration: 'none',
            letterSpacing: '0.02em',
            textAlign: 'center',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          Full form
        </Link>
      </div>

      {error && (
        <div role="alert" style={{ fontSize: 12, color: 'var(--phase-menstrual)' }}>
          {error}
        </div>
      )}
    </section>
  )
}
