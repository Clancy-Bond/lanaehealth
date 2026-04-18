'use client'

// ---------------------------------------------------------------------------
// PrnEffectivenessPoll
//
// In-app surface for the Wave 2e Bearable F7 feature: post-dose efficacy
// polling. Renders when there is at least one `prn_dose_events` row
// whose poll is "open" (poll_scheduled_for has passed, poll_response is
// still NULL, inside grace window).
//
// This is the fallback path for iOS PWA push unreliability. Even if the
// push notification never reaches Lanae, she will see this card on /log
// the next time she opens the app.
//
// Voice rule: the question is always "Did [med] help?". Never frame
// non-response as a failure. The dismiss button reads "Ask me later",
// not "Skip".
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react'
import type { PrnDoseEvent, PrnEfficacyResponse } from '@/lib/api/prn-doses'

interface PrnEffectivenessPollProps {
  /** Seed polls from server-side render. Client still polls for fresh state. */
  initialPolls?: PrnDoseEvent[]
  /** Endpoint that returns the open poll list (defaults to /api/prn-doses/open). */
  openPollsEndpoint?: string
  /** Endpoint that accepts the response (defaults to /api/prn-doses/respond). */
  respondEndpoint?: string
}

interface ResponseButton {
  value: PrnEfficacyResponse
  label: string
  colorVar: string
  bgVar: string
}

const RESPONSE_BUTTONS: ResponseButton[] = [
  { value: 'helped',    label: 'Helped',    colorVar: 'var(--accent-sage)',  bgVar: 'var(--accent-sage-muted)' },
  { value: 'no_change', label: 'No change', colorVar: 'var(--text-muted)',   bgVar: 'var(--bg-elevated)' },
  { value: 'worse',     label: 'Worse',     colorVar: 'var(--accent-blush)', bgVar: 'var(--accent-blush-muted)' },
]

function timeSince(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(diffMs) || diffMs < 0) return 'just now'
  const mins = Math.floor(diffMs / (60 * 1000))
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  const rem = mins % 60
  if (rem === 0) return `${hours} hr ago`
  return `${hours} hr ${rem} min ago`
}

export default function PrnEffectivenessPoll({
  initialPolls = [],
  openPollsEndpoint = '/api/prn-doses/open',
  respondEndpoint = '/api/prn-doses/respond',
}: PrnEffectivenessPollProps) {
  const [polls, setPolls] = useState<PrnDoseEvent[]>(initialPolls)
  const [pending, setPending] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  // On mount (and once per 60s while mounted) refresh the open-poll list
  // from the server. Cheap: returns 0-3 rows in the steady state.
  useEffect(() => {
    let cancelled = false

    async function refresh() {
      try {
        const res = await fetch(openPollsEndpoint, { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json() as { polls?: PrnDoseEvent[] }
        if (!cancelled && Array.isArray(json.polls)) {
          setPolls(json.polls)
        }
      } catch {
        // Non-fatal. Keep whatever polls we already have.
      }
    }

    refresh()
    const interval = setInterval(refresh, 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [openPollsEndpoint])

  const handleRespond = useCallback(async (
    id: string,
    response: PrnEfficacyResponse,
  ) => {
    setPending(id)
    try {
      await fetch(respondEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, response }),
      })
    } catch {
      // Swallow -- optimistic removal below; row will resurface on next refresh.
    } finally {
      setPending(null)
      setPolls(prev => prev.filter(p => p.id !== id))
    }
  }, [respondEndpoint])

  const handleDismiss = useCallback((id: string) => {
    // "Ask me later" is purely client-side. The row stays open in the DB
    // so the next /log visit re-surfaces it until Lanae answers or the
    // grace window closes (default 6 h).
    setDismissed(prev => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  const visible = polls.filter(p => !dismissed.has(p.id))
  if (visible.length === 0) return null

  return (
    <div className="space-y-2">
      {visible.map(dose => {
        const isPending = pending === dose.id
        return (
          <div
            key={dose.id}
            className="rounded-xl p-4"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: '1rem',
            }}
            role="group"
            aria-label={`Efficacy check for ${dose.medication_name}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Did {dose.medication_name} help?
                </p>
                <p
                  className="text-[11px] mt-0.5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {formatDoseSubtitle(dose)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDismiss(dose.id)}
                className="text-[11px] font-medium"
                style={{
                  color: 'var(--text-muted)',
                  background: 'transparent',
                  minHeight: 28,
                  padding: '4px 8px',
                }}
                aria-label="Ask me later"
              >
                Ask me later
              </button>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {RESPONSE_BUTTONS.map(btn => (
                <button
                  key={btn.value}
                  type="button"
                  disabled={isPending}
                  onClick={() => handleRespond(dose.id, btn.value)}
                  className="rounded-lg px-3 py-2 text-xs font-semibold"
                  style={{
                    background: btn.bgVar,
                    color: btn.colorVar,
                    minHeight: 36,
                    opacity: isPending ? 0.6 : 1,
                  }}
                  aria-label={`${btn.label} response`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function formatDoseSubtitle(dose: PrnDoseEvent): string {
  const parts: string[] = []
  if (dose.dose_amount !== null && dose.dose_amount !== undefined) {
    const amount = `${dose.dose_amount}${dose.dose_unit ? ' ' + dose.dose_unit : ''}`.trim()
    if (amount) parts.push(amount)
  }
  parts.push(`taken ${timeSince(dose.dose_time)}`)
  return parts.join(' - ')
}
