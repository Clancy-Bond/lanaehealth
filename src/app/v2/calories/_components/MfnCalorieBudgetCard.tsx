'use client'

/**
 * MfnCalorieBudgetCard
 *
 * MFN parity surface for /v2/calories. Mirrors
 * `docs/reference/mynetdiary/frames/full-tour/frame_0030.png`:
 *
 *  ┌─────────────────────────────────────────┐
 *  │  Calorie Budget                  [···]  │
 *  │            1,896                         │
 *  │  Exercise           Breakfast            │
 *  │  172                502                  │
 *  │           ╭───────╮                      │
 *  │  Steps    │ 1,868 │  Lunch               │
 *  │  1.2K     │ 28    │  204                 │
 *  │           │ left  │                      │
 *  │  Water    ╰───────╯  Dinner              │
 *  │  0                  720                  │
 *  │                                          │
 *  │  Notes              Snacks               │
 *  │  ✏                  442                  │
 *  │                                          │
 *  │       View All Meals →                   │
 *  └─────────────────────────────────────────┘
 *
 * One compound card that places the calorie ring at the center with
 * orbital stat slots on either side. The previous layout used three
 * stacked components (CalorieRingHero alone, MacroTilesRow below,
 * meal cards beneath). Visually correct for an Oura surface but the
 * MFN signature is exactly this single-card composition.
 *
 * Composition is intentional: the eye finds the ring first, then
 * sweeps left to read body / activity context (Exercise, Steps,
 * Water, Notes), then sweeps right to read the day's meal split
 * (Breakfast / Lunch / Dinner / Snacks). The result is a single-
 * glance answer to "where am I today?"
 *
 * Implementation notes:
 * - The ring SVG is sized for the 110pt MFN reference; the inner
 *   card padding is generous (24pt) so the slots breathe.
 * - Left/right slot rows use `display: grid` with two-column
 *   templates so labels and values align cleanly across all four
 *   slots regardless of digit count.
 * - "View All Meals" is a Link, not a button: it routes to
 *   /v2/calories/food (the per-meal item list).
 *
 * Server component: pure data + Link, no client interactivity.
 */
import Link from 'next/link'

const RING_SIZE = 130
const RING_STROKE = 14

export interface MealTotals {
  breakfast: number
  lunch: number
  dinner: number
  snack: number
}

export interface MfnCalorieBudgetCardProps {
  /** Daily calorie target (the "budget"). */
  target: number
  /** Calories consumed across all meals on viewDate. */
  consumed: number
  /** Per-meal totals (breakfast, lunch, dinner, snack). */
  meals: MealTotals
  /** Active calories burned (Oura activity → Exercise stat). */
  activeCalories: number | null
  /** Steps from Oura activity. */
  steps: number | null
  /** Water glasses logged for the day. */
  waterGlasses: number
  /** Number of free-form notes / log entries for the day. */
  notesCount: number
  /** Where "View All Meals" routes. Defaults to /v2/calories/food. */
  viewAllHref?: string
}

export default function MfnCalorieBudgetCard({
  target,
  consumed,
  meals,
  activeCalories,
  steps,
  waterGlasses,
  notesCount,
  viewAllHref = '/v2/calories/food',
}: MfnCalorieBudgetCardProps) {
  const remaining = target - consumed
  const isOver = remaining < 0

  return (
    <section
      aria-label="Calorie budget"
      style={{
        background: 'var(--v2-bg-card)',
        borderRadius: 'var(--v2-radius-lg)',
        border: '1px solid var(--v2-border-subtle)',
        padding: 'var(--v2-space-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-4)',
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 'var(--v2-space-3)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: 'var(--v2-weight-semibold)',
            }}
          >
            Calorie Budget
          </span>
          <span
            style={{
              fontSize: 'var(--v2-text-2xl)',
              fontWeight: 'var(--v2-weight-bold)',
              color: 'var(--v2-text-primary)',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.1,
            }}
          >
            {target.toLocaleString()}
          </span>
        </div>
      </header>

      {/* Three-column composition: left stats / ring / right meal totals */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          columnGap: 'var(--v2-space-4)',
          rowGap: 'var(--v2-space-4)',
        }}
      >
        {/* Left column */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-4)',
          }}
        >
          <StatSlot
            label="Exercise"
            value={activeCalories !== null ? activeCalories.toLocaleString() : '--'}
            suffix={activeCalories !== null ? ' cal' : ''}
          />
          <StatSlot
            label="Steps"
            value={steps !== null ? formatSteps(steps) : '--'}
          />
          <StatSlot label="Water" value={String(waterGlasses)} suffix={waterGlasses === 1 ? ' glass' : ' glasses'} />
          <StatSlot label="Notes" value={notesCount > 0 ? String(notesCount) : '–'} />
        </div>

        {/* Center: ring */}
        <CalorieRing
          consumed={consumed}
          remaining={remaining}
          target={target}
          isOver={isOver}
        />

        {/* Right column: meal totals */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-4)',
          }}
        >
          <StatSlot label="Breakfast" value={meals.breakfast.toLocaleString()} alignEnd />
          <StatSlot label="Lunch" value={meals.lunch.toLocaleString()} alignEnd />
          <StatSlot label="Dinner" value={meals.dinner.toLocaleString()} alignEnd />
          <StatSlot label="Snacks" value={meals.snack.toLocaleString()} alignEnd />
        </div>
      </div>

      {/* View All Meals */}
      <Link
        href={viewAllHref}
        style={{
          alignSelf: 'center',
          padding: 'var(--v2-space-2) var(--v2-space-4)',
          color: 'var(--v2-accent-primary)',
          fontSize: 'var(--v2-text-sm)',
          fontWeight: 'var(--v2-weight-semibold)',
          textDecoration: 'none',
          minHeight: 'var(--v2-touch-target-min)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        View All Meals
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <polyline points="9 6 15 12 9 18" />
        </svg>
      </Link>
    </section>
  )
}

function CalorieRing({
  consumed,
  remaining,
  target,
  isOver,
}: {
  consumed: number
  remaining: number
  target: number
  isOver: boolean
}) {
  const r = (RING_SIZE - RING_STROKE) / 2
  const circumference = 2 * Math.PI * r
  const ratio = target > 0 ? Math.min(1, consumed / target) : 0
  const dashLen = ratio * circumference

  // MFN uses green when under budget, red when over. Map to v2 tokens.
  const ringColor = isOver ? 'var(--v2-accent-danger)' : 'var(--v2-accent-primary)'
  const trackColor = 'rgba(255,255,255,0.06)'

  return (
    <div
      style={{
        position: 'relative',
        width: RING_SIZE,
        height: RING_SIZE,
        flexShrink: 0,
      }}
    >
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        style={{ transform: 'rotate(-90deg)' }}
        aria-hidden
      >
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={RING_STROKE}
        />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth={RING_STROKE}
          strokeDasharray={`${dashLen} ${circumference}`}
          strokeLinecap="round"
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          color: 'var(--v2-text-primary)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--v2-text-2xl)',
            fontWeight: 'var(--v2-weight-bold)',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
          }}
        >
          {consumed.toLocaleString()}
        </span>
        <span
          style={{
            marginTop: 4,
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-muted)',
            fontWeight: 'var(--v2-weight-semibold)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {isOver ? `${Math.abs(remaining).toLocaleString()} over` : `${remaining.toLocaleString()} left`}
        </span>
      </div>
    </div>
  )
}

function StatSlot({
  label,
  value,
  suffix,
  alignEnd = false,
}: {
  label: string
  value: string
  suffix?: string
  alignEnd?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        textAlign: alignEnd ? 'right' : 'left',
      }}
    >
      <span
        style={{
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-text-muted)',
          fontWeight: 'var(--v2-weight-semibold)',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 'var(--v2-text-lg)',
          fontWeight: 'var(--v2-weight-bold)',
          color: 'var(--v2-text-primary)',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.1,
        }}
      >
        {value}
        {suffix && (
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
              fontWeight: 'var(--v2-weight-medium)',
              marginLeft: 2,
            }}
          >
            {suffix}
          </span>
        )}
      </span>
    </div>
  )
}

function formatSteps(n: number): string {
  if (n >= 1000) {
    const k = n / 1000
    return k >= 10 ? `${Math.round(k)}K` : `${k.toFixed(1)}K`
  }
  return n.toLocaleString()
}
