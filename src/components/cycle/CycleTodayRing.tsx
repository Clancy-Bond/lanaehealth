/**
 * Hero ring showing cycle day + phase.
 *
 * Shared between /cycle landing and the home "cycle-today-ring" widget.
 * NaturalCycles pattern: big, readable, phase-coded. Warm-modern palette
 * throughout - no red alarm; overdue cycles get the blush stripe.
 *
 * When cycle data is unknown, render "Cycle unknown" per the voice rule.
 */
import type { CyclePhase } from '@/lib/types'
import { phaseBadgeColor } from '@/lib/cycle/fertile-window'

const PHASE_LABEL: Record<CyclePhase, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulatory: 'Ovulatory',
  luteal: 'Luteal',
}

const PHASE_BODY: Record<CyclePhase, string> = {
  menstrual: 'Period is happening. Rest and heat help.',
  follicular: 'Energy tends to rise as estrogen climbs.',
  ovulatory: 'Mid-cycle. Temperature and LH help confirm.',
  luteal: 'After ovulation, before next period.',
}

export interface CycleTodayRingProps {
  day: number | null
  phase: CyclePhase | null
  isUnusuallyLong: boolean
  /** Visual size: "hero" is full-page landing, "widget" fits home grid. */
  size?: 'hero' | 'widget'
}

export function CycleTodayRing({ day, phase, isUnusuallyLong, size = 'hero' }: CycleTodayRingProps) {
  const ringSize = size === 'hero' ? 136 : 96
  const fontSize = size === 'hero' ? 44 : 32
  const labelSize = size === 'hero' ? 11 : 9
  const strokeWidth = size === 'hero' ? 6 : 5

  const phaseColor = phase ? phaseBadgeColor(phase) : 'var(--border)'
  const unknown = day === null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: size === 'hero' ? 20 : 14,
      }}
    >
      <div
        aria-hidden
        style={{
          width: ringSize,
          height: ringSize,
          borderRadius: '50%',
          background: 'var(--bg-card)',
          border: `${strokeWidth}px solid ${phaseColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            className="tabular"
            style={{
              fontSize,
              fontWeight: 800,
              lineHeight: 1,
              color: unknown ? 'var(--text-muted)' : 'var(--text-primary)',
            }}
          >
            {unknown ? '\u2014' : day}
          </div>
          <div
            style={{
              fontSize: labelSize,
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginTop: 2,
            }}
          >
            {unknown ? 'day' : 'cycle day'}
          </div>
        </div>
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: phaseColor,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 4,
          }}
        >
          {phase ? PHASE_LABEL[phase] : 'Cycle unknown'}
        </div>
        <p
          style={{
            fontSize: size === 'hero' ? 15 : 13,
            margin: 0,
            lineHeight: 1.4,
            color: 'var(--text-secondary)',
          }}
        >
          {unknown
            ? 'Log your next period start to begin cycle tracking. Past imports will surface once at least one completed cycle is visible.'
            : isUnusuallyLong
              ? 'This cycle is running longer than a typical 21-35 day cycle. If a period has happened, logging it refreshes the estimate.'
              : phase
                ? PHASE_BODY[phase]
                : 'Cycle day is known but phase could not be inferred.'}
        </p>
      </div>
    </div>
  )
}
