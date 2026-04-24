/**
 * MetricStripHorizontal
 *
 * Oura's signature home chip strip: thin-bordered circles holding a
 * leading glyph and a number, with the label sitting BELOW the circle
 * (not inside a tile). Observed on frame_0001.png, frame_0010.png,
 * frame_0050.png. The card-shaped MetricTile felt heavier than Oura
 * because every chip carried its own surface lift; the circle removes
 * that lift entirely so the strip reads as data, not chrome.
 *
 * Each chip is a Link to its drill route. Tap the chip, land on the
 * section view. We do NOT open modals on home; modals live in the
 * drill pages where their copy fits the local context.
 *
 * Data contract: the chips read from the already-loaded HomeContext
 * so we never fan out new queries here.
 */
import Link from 'next/link'
import type { HomeContext } from '@/lib/v2/load-home-context'
import { bandConfig, bandForScore, secondsToHoursMinutes } from '@/lib/v2/home-signals'

export interface MetricStripHorizontalProps {
  ctx: HomeContext
}

interface Chip {
  href: string
  icon: string
  value: React.ReactNode
  label: string
  color: string
  ariaLabel: string
}

function buildChips(ctx: HomeContext): Chip[] {
  const latest = ctx.ouraTrend[ctx.ouraTrend.length - 1] ?? null
  const hasLatest = latest?.date === ctx.today

  const readinessChip: Chip = {
    href: '/v2/today',
    icon: '◎',
    value: hasLatest && latest?.readiness_score != null ? latest.readiness_score : '--',
    label: hasLatest ? 'Readiness' : 'Readiness',
    color: bandConfig(bandForScore(latest?.readiness_score)).color,
    ariaLabel: 'Open today snapshot',
  }

  const sleepChip: Chip = {
    href: '/v2/sleep',
    icon: '☾',
    value: hasLatest && latest?.sleep_score != null ? latest.sleep_score : '--',
    label: hasLatest && latest?.sleep_duration ? secondsToHoursMinutes(latest.sleep_duration) : 'Sleep',
    color: 'var(--v2-ring-sleep)',
    ariaLabel: 'Open sleep detail',
  }

  const hrvChip: Chip = {
    href: '/v2/sleep',
    icon: '♡',
    value: latest?.hrv_avg != null ? Math.round(latest.hrv_avg) : '--',
    label: 'HRV',
    color: 'var(--v2-accent-primary)',
    ariaLabel: 'Open HRV trend',
  }

  const cycleDay = ctx.cycle?.current?.day
  const cyclePhase = ctx.cycle?.current?.phase
  const cycleChip: Chip = {
    href: '/v2/cycle',
    icon: '○',
    value: cycleDay != null ? cycleDay : '--',
    label: cyclePhase ? `${cyclePhase[0].toUpperCase()}${cyclePhase.slice(1)}` : 'Log a period',
    color: ctx.cycle?.current?.isUnusuallyLong ? 'var(--v2-accent-warning)' : 'var(--v2-surface-explanatory-accent)',
    ariaLabel: 'Open cycle detail',
  }

  const painVal = ctx.dailyLog?.overall_pain
  const painChip: Chip = {
    href: '/v2/log',
    icon: '~',
    value: painVal != null ? `${painVal}` : '--',
    label: ctx.dailyLog ? 'Pain' : 'Log pain',
    color:
      painVal == null
        ? 'var(--v2-text-muted)'
        : painVal >= 6
          ? 'var(--v2-accent-warning)'
          : painVal >= 3
            ? 'var(--v2-accent-highlight)'
            : 'var(--v2-accent-success)',
    ariaLabel: 'Open daily log',
  }

  const caloriesChip: Chip = {
    href: '/v2/calories',
    icon: '⊕',
    value: ctx.calories && ctx.calories.calories > 0 ? Math.round(ctx.calories.calories) : '--',
    label: ctx.calories && ctx.calories.entryCount > 0 ? 'Calories' : 'Log a meal',
    color: 'var(--v2-accent-primary)',
    ariaLabel: 'Open food log',
  }

  return [readinessChip, sleepChip, cycleChip, hrvChip, painChip, caloriesChip]
}

export default function MetricStripHorizontal({ ctx }: MetricStripHorizontalProps) {
  const chips = buildChips(ctx)
  return (
    <div
      role="list"
      aria-label="Today's metrics"
      style={{
        display: 'flex',
        gap: 'var(--v2-space-4)',
        overflowX: 'auto',
        overflowY: 'hidden',
        paddingBottom: 'var(--v2-space-2)',
        scrollSnapType: 'x proximity',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}
    >
      {chips.map((chip) => (
        <Link
          key={chip.href + chip.label}
          href={chip.href}
          role="listitem"
          aria-label={chip.ariaLabel}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--v2-space-1)',
            textDecoration: 'none',
            color: 'inherit',
            scrollSnapAlign: 'start',
            flexShrink: 0,
            minWidth: 64,
          }}
        >
          <span
            style={{
              width: 64,
              height: 64,
              borderRadius: 'var(--v2-radius-full)',
              border: '1px solid var(--v2-border)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              background: 'transparent',
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 13, lineHeight: 1, color: 'var(--v2-text-muted)' }}>
              {chip.icon}
            </span>
            <span
              style={{
                fontSize: 'var(--v2-text-lg)',
                fontWeight: 'var(--v2-weight-medium)',
                color: chip.color,
                lineHeight: 1,
                letterSpacing: 'var(--v2-tracking-tight)',
              }}
            >
              {chip.value}
            </span>
          </span>
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 1.2,
              textAlign: 'center',
              maxWidth: 80,
            }}
          >
            {chip.label}
          </span>
        </Link>
      ))}
    </div>
  )
}
