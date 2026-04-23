/**
 * Pure helpers for the v2 home surfaces.
 *
 * Keep these stateless and deterministic. Home, Today, and Sleep all
 * import from here, so a bug here shows up in three places.
 *
 * No external deps, no side effects, no DB reads. Those live in
 * load-home-context.ts.
 */

export type Band = 'optimal' | 'good' | 'fair' | 'payAttention'

export interface BandConfig {
  label: string
  color: string
}

/*
 * LEARNING-MODE HOOK H1: Score band thresholds.
 *
 * Oura's observed vocabulary is "Optimal / Good / Fair / Pay attention".
 * The numeric cut-points below mirror Oura's readiness defaults but
 * Lanae's data runs lower in flare weeks. Tune if the "Fair" bucket
 * dominates the chip strip on healthy days.
 *
 *   Default:     optimal ≥ 85, good ≥ 70, fair ≥ 60, else payAttention
 *   Gentler:     optimal ≥ 80, good ≥ 65, fair ≥ 50, else payAttention
 *   Stricter:    optimal ≥ 90, good ≥ 80, fair ≥ 70, else payAttention
 */
export function bandForScore(score: number | null | undefined): Band {
  if (score == null || !Number.isFinite(score)) return 'payAttention'
  if (score >= 85) return 'optimal'
  if (score >= 70) return 'good'
  if (score >= 60) return 'fair'
  return 'payAttention'
}

const BAND_CONFIG: Record<Band, BandConfig> = {
  optimal: { label: 'Optimal', color: 'var(--v2-accent-success)' },
  good: { label: 'Good', color: 'var(--v2-accent-primary)' },
  fair: { label: 'Fair', color: 'var(--v2-accent-highlight)' },
  payAttention: { label: 'Pay attention', color: 'var(--v2-accent-warning)' },
}

export function bandConfig(band: Band): BandConfig {
  return BAND_CONFIG[band]
}

/**
 * Up / down / flat arrow glyph for trend deltas. The threshold of 0.5
 * ignores near-noise movement so a 70 vs 70.3 score reads as flat,
 * not rising.
 */
export function directionArrow(delta: number | null | undefined): '↑' | '↓' | '→' {
  if (delta == null || !Number.isFinite(delta) || Math.abs(delta) < 0.5) return '→'
  return delta > 0 ? '↑' : '↓'
}

/**
 * "today" / "yesterday" / "N days ago" relative to a reference date.
 * Both inputs are ISO dates (YYYY-MM-DD); the reference defaults to
 * today in UTC. Values older than 14 days render as the full date so
 * readers don't have to do mental arithmetic.
 */
export function humanTimeAgo(iso: string | null | undefined, todayIso?: string): string {
  if (!iso) return 'no data'
  const today = todayIso ?? new Date().toISOString().slice(0, 10)
  const then = new Date(iso + 'T00:00:00Z').getTime()
  const now = new Date(today + 'T00:00:00Z').getTime()
  if (!Number.isFinite(then) || !Number.isFinite(now)) return 'no data'
  const days = Math.floor((now - then) / 86_400_000)
  if (days < 0) return 'upcoming'
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days <= 14) return `${days} days ago`
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Median of a numeric sample, ignoring null/undefined/NaN. Returns null
 * when the filtered sample is empty. Small helper for "delta from your
 * 7-day median" copy in tiles.
 */
export function median(values: Array<number | null | undefined>): number | null {
  const clean = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (clean.length === 0) return null
  const sorted = [...clean].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/**
 * Delta of the newest value in the window from the median of the rest.
 * Returns null when the window has < 3 data points so early-logging
 * days don't surface noisy trend arrows.
 */
export function deltaFromMedian(values: Array<number | null | undefined>): number | null {
  const clean = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (clean.length < 3) return null
  const latest = clean[clean.length - 1]
  const rest = clean.slice(0, -1)
  const m = median(rest)
  if (m == null) return null
  return latest - m
}

/**
 * Hour-of-day greeting. Uses local time. Kept flexible so /today and
 * /v2 agree without coordination.
 */
export function greetingFor(hour: number): string {
  if (hour < 5) return 'Resting well'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  if (hour < 21) return 'Good evening'
  return 'Winding down'
}

/**
 * Seconds to "Xh Ym" for sleep duration. Renders "--" on null so
 * callers don't have to branch.
 */
export function secondsToHoursMinutes(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '--'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

/**
 * Nicely formatted date header ("Thursday, April 20"). Uses local
 * weekday and month so the home screen always feels rooted in the
 * user's day.
 */
export function formatLongDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}
