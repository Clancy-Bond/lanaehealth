/*
 * TopicCycleTodayCard
 *
 * Shows the patient's current cycle day + phase at the top of the
 * /v2/topics/cycle deep-dive. Consumes the shared getCurrentCycleDay
 * helper's return shape directly so this surface always agrees with
 * the home page and the daily /v2/cycle tracker.
 *
 * When the cycle runs past the ACOG 35-day threshold, we surface a
 * non-alarming note in warning color. We never cap or hide the day
 * value : the raw number is clinically meaningful.
 */
import { Card } from '@/v2/components/primitives'
import type { CyclePhase } from '@/lib/types'

export interface TopicCycleTodayCardProps {
  day: number | null
  phase: CyclePhase | null
  isUnusuallyLong: boolean
}

export default function TopicCycleTodayCard({
  day,
  phase,
  isUnusuallyLong,
}: TopicCycleTodayCardProps) {
  const dayLabel = day !== null ? String(day) : '\u2014'

  return (
    <Card padding="md">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-2)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--v2-text-xs)',
            fontWeight: 'var(--v2-weight-semibold)',
            color: 'var(--v2-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--v2-tracking-wide)',
          }}
        >
          Today
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 'var(--v2-space-2)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--v2-text-3xl)',
              fontWeight: 'var(--v2-weight-bold)',
              color: 'var(--v2-text-primary)',
              letterSpacing: 'var(--v2-tracking-tight)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {dayLabel}
          </span>
          <span
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-muted)',
              fontWeight: 'var(--v2-weight-medium)',
            }}
          >
            cycle day
          </span>
        </div>
        {phase && (
          <div
            style={{
              fontSize: 'var(--v2-text-base)',
              color: 'var(--v2-text-secondary)',
              fontWeight: 'var(--v2-weight-medium)',
            }}
          >
            {phase} phase
          </div>
        )}
        {isUnusuallyLong && (
          <p
            style={{
              margin: 0,
              marginTop: 'var(--v2-space-1)',
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-accent-warning)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            This cycle is running longer than your typical pattern.
          </p>
        )}
      </div>
    </Card>
  )
}
