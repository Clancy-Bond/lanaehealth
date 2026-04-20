/**
 * MetricStripHorizontal
 *
 * The Oura home tile strip. Horizontally scrolling chips at 375pt that
 * fit 5 visible tiles, scroll-snap to tile edges for a nice feel.
 *
 * Every tile is a Link to its drill route. Tap the tile, land on the
 * section view. We do NOT open modals on home; modals live in the
 * drill pages where their copy fits the local context.
 *
 * Data contract: the tiles read from the already-loaded HomeContext
 * so we never fan out new queries here.
 */
import Link from 'next/link'
import { MetricTile } from '@/v2/components/primitives'
import type { HomeContext } from '@/lib/v2/load-home-context'
import { bandConfig, bandForScore, secondsToHoursMinutes } from '@/lib/v2/home-signals'

export interface MetricStripHorizontalProps {
  ctx: HomeContext
}

interface Tile {
  href: string
  icon: string
  value: React.ReactNode
  label: string
  color: string
  ariaLabel: string
}

function buildTiles(ctx: HomeContext): Tile[] {
  const latest = ctx.ouraTrend[ctx.ouraTrend.length - 1] ?? null
  const hasLatest = latest?.date === ctx.today

  const readinessTile: Tile = {
    href: '/v2/today',
    icon: '◎',
    value: hasLatest && latest?.readiness_score != null ? latest.readiness_score : '—',
    label: hasLatest ? 'Readiness' : 'Readiness (no data today)',
    color: bandConfig(bandForScore(latest?.readiness_score)).color,
    ariaLabel: 'Open today snapshot',
  }

  const sleepTile: Tile = {
    href: '/v2/sleep',
    icon: '☾',
    value: hasLatest && latest?.sleep_score != null ? latest.sleep_score : '—',
    label: hasLatest && latest?.sleep_duration ? secondsToHoursMinutes(latest.sleep_duration) : 'Sleep',
    color: 'var(--v2-ring-sleep)',
    ariaLabel: 'Open sleep detail',
  }

  const hrvTile: Tile = {
    href: '/v2/sleep',
    icon: '♡',
    value: latest?.hrv_avg != null ? Math.round(latest.hrv_avg) : '—',
    label: 'HRV',
    color: 'var(--v2-accent-primary)',
    ariaLabel: 'Open HRV trend',
  }

  const cycleDay = ctx.cycle?.current?.day
  const cyclePhase = ctx.cycle?.current?.phase
  const cycleTile: Tile = {
    href: '/v2/cycle',
    icon: '○',
    value: cycleDay != null ? cycleDay : '—',
    label: cyclePhase ? `${cyclePhase[0].toUpperCase()}${cyclePhase.slice(1)}` : 'Log a period',
    color: ctx.cycle?.current?.isUnusuallyLong ? 'var(--v2-accent-warning)' : 'var(--v2-surface-explanatory-accent)',
    ariaLabel: 'Open cycle detail',
  }

  const painVal = ctx.dailyLog?.overall_pain
  const painTile: Tile = {
    href: '/v2/log',
    icon: '~',
    value: painVal != null ? `${painVal}/10` : '—',
    label: ctx.dailyLog ? 'Pain today' : 'Log pain',
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

  const caloriesTile: Tile = {
    href: '/v2/calories',
    icon: '⊕',
    value: ctx.calories && ctx.calories.calories > 0 ? Math.round(ctx.calories.calories) : '—',
    label: ctx.calories && ctx.calories.entryCount > 0 ? 'Calories today' : 'Log a meal',
    color: 'var(--v2-accent-primary)',
    ariaLabel: 'Open food log',
  }

  return [readinessTile, sleepTile, cycleTile, hrvTile, painTile, caloriesTile]
}

export default function MetricStripHorizontal({ ctx }: MetricStripHorizontalProps) {
  const tiles = buildTiles(ctx)
  return (
    <div
      role="list"
      aria-label="Today's metrics"
      style={{
        display: 'flex',
        gap: 'var(--v2-space-3)',
        overflowX: 'auto',
        overflowY: 'hidden',
        paddingBottom: 'var(--v2-space-2)',
        scrollSnapType: 'x proximity',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}
    >
      {tiles.map((tile) => (
        <Link
          key={tile.href + tile.label}
          href={tile.href}
          role="listitem"
          aria-label={tile.ariaLabel}
          style={{
            textDecoration: 'none',
            color: 'inherit',
            scrollSnapAlign: 'start',
            flexShrink: 0,
          }}
        >
          <MetricTile icon={tile.icon} value={tile.value} label={tile.label} color={tile.color} />
        </Link>
      ))}
    </div>
  )
}
