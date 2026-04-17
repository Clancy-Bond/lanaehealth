'use client'

// ---------------------------------------------------------------------------
// MicroCareDrawer
//
// A bottom-sheet drawer that surfaces 10 curated 30-second self-care actions
// tuned for Lanae's POTS + endo + nervous-system profile (see
// src/lib/micro-care/actions.ts for the registry). Tapping any action either
// logs it directly (single-tap) or runs a short in-card flow (timer /
// breathing / grounding) and then logs completion.
//
// Voice rules (see docs/plans/2026-04-16-non-shaming-voice-rule.md):
//   - Header: "Quick action. 30 seconds."  (offer, not demand)
//   - Close reads "Back soon" - never "Abandon" or "Cancel task".
//   - We surface a GENTLE cumulative presence count, never a streak,
//     never a percentage, never a denominator.
//   - There is no "goal met" or "complete this task" copy anywhere.
//
// The drawer mounts with a trigger button that the parent can place
// wherever it wants on the log page. This component is fully
// self-contained (trigger + backdrop + sheet) so the parent integration
// is a single <MicroCareDrawer /> tag with no props required.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react'
import { MICRO_CARE_ACTIONS } from '@/lib/micro-care/actions'
import MicroCareAction from '@/components/log/MicroCareAction'

interface Props {
  // Optional override for the trigger button label. Defaults to the
  // non-shaming "Quick action. 30 seconds." label.
  triggerLabel?: string
}

export default function MicroCareDrawer({ triggerLabel }: Props) {
  const [open, setOpen] = useState(false)
  const [count7d, setCount7d] = useState<number | null>(null)
  const [countLoading, setCountLoading] = useState(false)

  const refreshCount = useCallback(async () => {
    setCountLoading(true)
    try {
      const res = await fetch('/api/micro-care', { method: 'GET', cache: 'no-store' })
      if (res.ok) {
        const body = await res.json().catch(() => ({ count: null }))
        if (typeof body.count === 'number') setCount7d(body.count)
      }
    } catch {
      // Network hiccups are non-fatal; we simply don't show a count.
    } finally {
      setCountLoading(false)
    }
  }, [])

  // Fetch once on open so returning users see their gentle presence
  // count. We purposefully do NOT fetch on mount - the drawer must stay
  // cheap for page loads.
  useEffect(() => {
    if (open && count7d === null) void refreshCount()
  }, [open, count7d, refreshCount])

  const handleComplete = useCallback(
    async (slug: string, durationSeconds: number) => {
      try {
        const res = await fetch('/api/micro-care', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ actionSlug: slug, durationSeconds }),
        })
        if (res.ok) {
          // Refresh the gentle presence count after a successful log.
          void refreshCount()
        }
      } catch {
        // Swallow - doing the action matters more than the DB row.
      }
    },
    [refreshCount]
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press-feedback w-full rounded-2xl px-4 py-3 text-left flex items-center justify-between"
        style={{
          background: '#FFFDF9',
          border: '1px solid rgba(107, 144, 128, 0.15)',
          color: '#3a3a3a',
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="flex flex-col">
          <span className="text-sm font-medium">
            {triggerLabel ?? 'Quick action. 30 seconds.'}
          </span>
          <span className="text-xs" style={{ color: '#8a8a8a' }}>
            Salt, breath, legs up, or a gentle stretch.
          </span>
        </span>
        <span aria-hidden style={{ color: '#6B9080', fontSize: 18 }}>
          +
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Micro-care actions"
        >
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.35)',
            }}
          />
          {/* Sheet */}
          <div
            className="relative w-full md:max-w-lg"
            style={{
              background: '#FAFAF7',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              boxShadow: '0 -8px 24px rgba(0,0,0,0.1)',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
          >
            {/* Grab bar */}
            <div
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                background: 'rgba(58,58,58,0.2)',
                margin: '10px auto 4px',
              }}
              aria-hidden
            />
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-base font-semibold" style={{ color: '#3a3a3a' }}>
                    Quick action. 30 seconds.
                  </div>
                  <div className="text-xs" style={{ color: '#8a8a8a' }}>
                    Small moves that help. Pick one.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="press-feedback px-3 py-1.5 rounded-full text-xs font-medium"
                  style={{
                    background: 'transparent',
                    color: '#6B9080',
                    border: '1px solid #6B9080',
                  }}
                  aria-label="Close micro-care drawer"
                >
                  Back soon
                </button>
              </div>

              {/* Gentle presence count (positive framing only; no streak,
                  no percentage, no denominator). Hidden when we have no
                  count yet to avoid an empty-state tease. */}
              {count7d !== null && count7d > 0 && !countLoading && (
                <div
                  className="text-xs mb-3"
                  style={{ color: '#6B9080' }}
                >
                  {`You chose care ${count7d} ${count7d === 1 ? 'time' : 'times'} this week.`}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {MICRO_CARE_ACTIONS.map((action) => (
                  <MicroCareAction
                    key={action.slug}
                    action={action}
                    onComplete={handleComplete}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
