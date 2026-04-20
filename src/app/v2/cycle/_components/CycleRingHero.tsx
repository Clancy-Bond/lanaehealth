'use client'

/*
 * CycleRingHero
 *
 * FOUNDATION-REQUEST: MetricRing could accept { value, max, unit } for
 * tabular-center display ("Day 14 of ~28"). For now we map cycle day to
 * 0-100 against the user's mean length and pass a custom displayValue.
 */
import { MetricRing } from '@/v2/components/primitives'
import type { CyclePhase } from '@/lib/types'

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

export interface CycleRingHeroProps {
  day: number | null
  phase: CyclePhase | null
  isUnusuallyLong: boolean
  meanCycleLength: number | null
}

export default function CycleRingHero({ day, phase, isUnusuallyLong, meanCycleLength }: CycleRingHeroProps) {
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
      <span style={{ color: 'var(--v2-text-muted)' }}>—</span>
    )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--v2-space-3)' }}>
      <MetricRing value={pct} color={color} size="lg" label={phase ? PHASE_LABEL[phase] : 'Log a period'} displayValue={displayValue} />
      {isUnusuallyLong && (
        <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', color: 'var(--v2-accent-warning)', textAlign: 'center', maxWidth: 280, lineHeight: 'var(--v2-leading-normal)' }}>
          Running long. Cycles vary; this is information, not alarm.
        </p>
      )}
    </div>
  )
}
