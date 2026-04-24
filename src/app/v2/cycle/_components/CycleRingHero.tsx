'use client'

'use client'

/*
 * CycleRingHero
 *
 * FOUNDATION-REQUEST: MetricRing could accept { value, max, unit } for
 * tabular-center display ("Day 14 of ~28"). For now we map cycle day to
 * 0-100 against the user's mean length and pass a custom displayValue.
 *
 * Tap-to-explain (PR #45 pattern, extended): the day cluster opens a
 * CycleDayExplainer; the phase label opens a PhaseExplainer. Both
 * surface modals so the reader can self-serve definitions in one tap.
 */
import { useState } from 'react'
import { MetricRing } from '@/v2/components/primitives'
import type { CyclePhase } from '@/lib/types'
import { CycleDayExplainer, PhaseExplainer } from './MetricExplainers'

const PHASE_COLOR: Record<CyclePhase, string> = {
  menstrual: 'var(--v2-surface-explanatory-accent)',
  follicular: 'var(--v2-accent-primary)',
  ovulatory: 'var(--v2-surface-explanatory-accent-alt)',
  luteal: 'var(--v2-ring-sleep)',
}

const PHASE_LABEL: Record<CyclePhase, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulatory: 'Ovulatory',
  luteal: 'Luteal',
}

type OpenKey = 'day' | 'phase' | null

export interface CycleRingHeroProps {
  day: number | null
  phase: CyclePhase | null
  isUnusuallyLong: boolean
  meanCycleLength: number | null
  lastPeriodISO?: string | null
}

export default function CycleRingHero({
  day,
  phase,
  isUnusuallyLong,
  meanCycleLength,
  lastPeriodISO = null,
}: CycleRingHeroProps) {
  const [openKey, setOpenKey] = useState<OpenKey>(null)
  const denom = meanCycleLength && meanCycleLength > 0 ? meanCycleLength : 28
  const pct = day != null ? Math.min(100, (day / denom) * 100) : 0
  const color = isUnusuallyLong
    ? 'var(--v2-accent-warning)'
    : phase
      ? PHASE_COLOR[phase]
      : 'var(--v2-border-strong)'

  const displayValue =
    day != null ? (
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-muted)', letterSpacing: 'var(--v2-tracking-wide)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
          Day
        </span>
        {day}
      </span>
    ) : (
      <span style={{ color: 'var(--v2-text-muted)' }}>--</span>
    )

  const phaseLabel = phase ? PHASE_LABEL[phase] : 'Log a period'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--v2-space-3)' }}>
      <button
        type="button"
        aria-label="Open cycle day explainer"
        onClick={() => setOpenKey('day')}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          color: 'inherit',
          font: 'inherit',
          lineHeight: 0,
        }}
      >
        <MetricRing value={pct} color={color} size="lg" label={phaseLabel} displayValue={displayValue} />
      </button>

      <button
        type="button"
        aria-label="Open cycle phase explainer"
        onClick={() => setOpenKey('phase')}
        style={{
          background: 'transparent',
          border: '1px solid var(--v2-border-subtle)',
          borderRadius: 'var(--v2-radius-full)',
          padding: 'var(--v2-space-1) var(--v2-space-3)',
          cursor: 'pointer',
          color: 'var(--v2-text-secondary)',
          fontSize: 'var(--v2-text-xs)',
          letterSpacing: 'var(--v2-tracking-wide)',
          textTransform: 'uppercase',
          font: 'inherit',
        }}
      >
        About {phaseLabel.toLowerCase()} phase
      </button>

      {isUnusuallyLong && (
        <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', color: 'var(--v2-accent-warning)', textAlign: 'center', maxWidth: 280, lineHeight: 'var(--v2-leading-normal)' }}>
          Running long. Cycles vary; this is information, not alarm.
        </p>
      )}

      <CycleDayExplainer
        open={openKey === 'day'}
        onClose={() => setOpenKey(null)}
        day={day}
        meanCycleLength={meanCycleLength}
        isUnusuallyLong={isUnusuallyLong}
        lastPeriodISO={lastPeriodISO}
      />
      <PhaseExplainer
        open={openKey === 'phase'}
        onClose={() => setOpenKey(null)}
        phase={phase}
        day={day}
      />
    </div>
  )
}
