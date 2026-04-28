/*
 * NCPeriodLogHero
 *
 * The pink hero block at the top of NC's period-log entry surface.
 * Source: docs/reference/natural-cycles/flows.md "Period log":
 *
 *   - Pink hero block indicating the current phase.
 *   - List of flow options (light / medium / heavy / spotting) as
 *     big pill buttons.
 *   - Copy: "You're in day 7 of your cycle. Log what you're feeling
 *     today."
 *
 * Mounted at the top of /v2/cycle/log so the user sees the same
 * "ask, do not demand" voice that NC uses, then sinks into the
 * existing PeriodLogFormV2 for the deeper sections (mucus,
 * ovulation signs, mood, endo notes).
 *
 * The four flow pills POST to /api/cycle/log inline so a one-tap
 * "I'm bleeding light today" interaction completes without scrolling
 * the rest of the form. The form below stays mounted and re-hydrates
 * on the next page load via initialFlow.
 */
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { CyclePhase, FlowLevel } from '@/lib/types'

export interface NCPeriodLogHeroProps {
  /** ISO date being logged. Threaded into the inline POST. */
  date: string
  /** Current cycle day for the hero copy ("You're in day 7..."). */
  cycleDay: number | null
  /** Current calendar phase. Drives the hero tint. */
  phase: CyclePhase | null
  /** Pre-existing flow on this date (drives the active pill). */
  initialFlow: FlowLevel | null
}

const FLOW_PILLS: { value: FlowLevel; label: string }[] = [
  { value: 'spotting', label: 'Spotting' },
  { value: 'light', label: 'Light' },
  { value: 'medium', label: 'Medium' },
  { value: 'heavy', label: 'Heavy' },
]

const PHASE_TINT: Record<NonNullable<CyclePhase>, string> = {
  menstrual: 'rgba(232, 69, 112, 0.18)',
  follicular: 'rgba(77, 184, 168, 0.16)',
  ovulatory: 'rgba(229, 201, 82, 0.18)',
  luteal: 'rgba(155, 127, 224, 0.16)',
}

const PHASE_ACCENT: Record<NonNullable<CyclePhase>, string> = {
  menstrual: '#E84570',
  follicular: '#4DB8A8',
  ovulatory: '#E5C952',
  luteal: '#9B7FE0',
}

export default function NCPeriodLogHero({ date, cycleDay, phase, initialFlow }: NCPeriodLogHeroProps) {
  const router = useRouter()
  const [flow, setFlow] = useState<FlowLevel | null>(initialFlow)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const safePhase: NonNullable<CyclePhase> = phase ?? 'follicular'
  const tint = PHASE_TINT[safePhase]
  const accent = PHASE_ACCENT[safePhase]

  const headline = cycleDay != null ? `You're in day ${cycleDay} of your cycle.` : 'Tracking your cycle.'
  const subtitle = 'Log what you are feeling today.'

  async function pickFlow(next: FlowLevel) {
    // Optimistic: paint the new pill immediately so the tap feels
    // instant. The POST runs in a transition so the form below stays
    // interactive while we save.
    const prev = flow
    setFlow(next)
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/cycle/log', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            date,
            flow_level: next,
            menstruation: next !== 'spotting',
          }),
        })
        if (!res.ok) {
          setFlow(prev)
          const body = (await res.json().catch(() => null)) as { error?: string } | null
          setError(body?.error ?? 'Could not save. Try the form below.')
          return
        }
        // Refresh server data so the rest of the form / cycle screen
        // sees the new flow on the next render.
        router.refresh()
      } catch (err) {
        setFlow(prev)
        setError(err instanceof Error ? err.message : 'Network error.')
      }
    })
  }

  return (
    <section
      aria-label="Quick period log"
      style={{
        background: tint,
        border: `1px solid ${accent}33`,
        borderRadius: 'var(--v2-radius-lg)',
        padding: 'var(--v2-space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-3)',
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-1)' }}>
        <h2
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-lg)',
            fontWeight: 'var(--v2-weight-bold)',
            color: 'var(--v2-surface-explanatory-text, #2D193C)',
            letterSpacing: 'var(--v2-tracking-tight)',
          }}
        >
          {headline}
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-sm)',
            lineHeight: 'var(--v2-leading-relaxed)',
            color: 'var(--v2-surface-explanatory-text-muted, rgba(45, 25, 60, 0.7))',
          }}
        >
          {subtitle}
        </p>
      </header>

      <div
        role="radiogroup"
        aria-label="Flow level"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 'var(--v2-space-2)',
        }}
      >
        {FLOW_PILLS.map((p) => {
          const isActive = flow === p.value
          return (
            <button
              key={p.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => pickFlow(p.value)}
              disabled={pending && !isActive}
              style={{
                minHeight: 48,
                padding: '12px 16px',
                borderRadius: 'var(--v2-radius-full)',
                border: isActive
                  ? `1.5px solid ${accent}`
                  : '1.5px solid var(--v2-surface-explanatory-border, rgba(45, 25, 60, 0.12))',
                background: isActive
                  ? accent
                  : 'var(--v2-surface-explanatory-card, #FFFFFF)',
                color: isActive
                  ? '#fff'
                  : 'var(--v2-surface-explanatory-text, #2D193C)',
                fontSize: 'var(--v2-text-base)',
                fontWeight: 'var(--v2-weight-semibold)',
                fontFamily: 'inherit',
                cursor: 'pointer',
                transition:
                  'background 120ms ease, color 120ms ease, border-color 120ms ease',
              }}
            >
              {p.label}
            </button>
          )
        })}
      </div>
      {error && (
        <p
          role="alert"
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-sm)',
            color: '#A0264A',
          }}
        >
          {error}
        </p>
      )}
    </section>
  )
}
