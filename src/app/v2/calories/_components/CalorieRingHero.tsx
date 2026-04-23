/*
 * CalorieRingHero
 *
 * Dashboard hero for /v2/calories. MetricRing (size lg) with the
 * center showing remaining cal (big) or overage as "+N" when past
 * the target. The ring color swaps from teal (under) to terracotta
 * (over). No red panic. No "over budget". Just "Over" as a neutral
 * marker, consistent with NC's non-shaming register.
 *
 * FOUNDATION-REQUEST: MetricRing could accept a numeric displayValue
 * with a caption slot so tabular-num alignment is centralized. For
 * Session 02 we compose manually, the same pattern as CycleRingHero.
 */
import { MetricRing } from '@/v2/components/primitives'

export interface CalorieRingHeroProps {
  /** Calories eaten today. */
  eaten: number
  /** Daily calorie target (from nutrition_goals). */
  target: number
}

export default function CalorieRingHero({ eaten, target }: CalorieRingHeroProps) {
  const safeTarget = target > 0 ? target : 1
  const overTarget = eaten > safeTarget
  const remaining = Math.max(0, safeTarget - eaten)
  const overage = Math.max(0, eaten - safeTarget)
  const pct = Math.max(0, Math.min(100, (eaten / safeTarget) * 100))
  const color = overTarget ? 'var(--v2-accent-warning)' : 'var(--v2-accent-primary)'
  const centerLabel = overTarget ? 'Over' : 'Remaining'
  const centerNumber = overTarget ? `+${Math.round(overage)}` : Math.round(remaining)
  const isEmpty = eaten === 0

  const displayValue = (
    <span
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span
        style={{
          fontSize: 'var(--v2-text-3xl)',
          fontWeight: 'var(--v2-weight-bold)',
          letterSpacing: 'var(--v2-tracking-tight)',
          color: isEmpty ? 'var(--v2-text-muted)' : 'var(--v2-text-primary)',
        }}
      >
        {centerNumber}
      </span>
      <span
        style={{
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-text-muted)',
          marginTop: 4,
          letterSpacing: 'var(--v2-tracking-wide)',
          textTransform: 'uppercase',
        }}
      >
        cal
      </span>
    </span>
  )

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--v2-space-3)',
      }}
      aria-label={
        isEmpty
          ? `No calories logged yet. Target ${Math.round(safeTarget)}.`
          : overTarget
            ? `Over target by ${Math.round(overage)} calories. Eaten ${Math.round(eaten)} of ${Math.round(safeTarget)}.`
            : `${Math.round(remaining)} calories remaining. Eaten ${Math.round(eaten)} of ${Math.round(safeTarget)}.`
      }
    >
      <MetricRing
        value={pct}
        color={color}
        size="lg"
        label={centerLabel}
        displayValue={displayValue}
      />
      <p
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-sm)',
          color: 'var(--v2-text-muted)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {Math.round(eaten)} of {Math.round(safeTarget)} cal
      </p>
    </div>
  )
}
