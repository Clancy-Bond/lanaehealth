/**
 * Rolling-window delta math for lab trend sparklines.
 *
 * The D3 brief specifies the delta badge must compare the current value
 * against 30-day, 90-day, and 1-year rolling medians. These helpers are
 * pure so they can be tested without any React / DOM plumbing.
 */

export interface TimedValue {
  /** ISO date string (YYYY-MM-DD) of the observation. */
  date: string
  /** Numeric value. Must be finite. */
  value: number
}

export interface DeltaWindow {
  /** Window label: '30d' | '90d' | '1y'. */
  label: '30d' | '90d' | '1y'
  /** Days in the window. */
  days: number
  /** Median of all prior observations inside the window, or null if none. */
  median: number | null
  /** Current minus median, or null if median is null. */
  delta: number | null
  /** Delta as a percentage of the median, or null if median is 0 or null. */
  percent: number | null
  /** How many observations contributed to the median. */
  sampleSize: number
}

export interface DeltaSummary {
  current: number
  currentDate: string
  windows: DeltaWindow[]
}

/**
 * Compute the median of a numeric array. Returns null when the array is
 * empty. Handles even-length arrays by averaging the two middle values.
 */
export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}

/**
 * Days between two ISO date strings (YYYY-MM-DD), as an integer.
 * Positive when `b` is later than `a`. Uses UTC midnight to avoid DST
 * drift.
 */
export function daysBetween(aIso: string, bIso: string): number {
  const a = Date.parse(aIso + 'T00:00:00Z')
  const b = Date.parse(bIso + 'T00:00:00Z')
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((b - a) / (1000 * 60 * 60 * 24))
}

const WINDOW_DEFS: Array<{ label: '30d' | '90d' | '1y'; days: number }> = [
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '1y', days: 365 },
]

/**
 * Compute a DeltaSummary for a series. The "current" point is the latest
 * row in the series (by date). Each window's median is calculated over
 * observations in the interval [current.date - N days, current.date), i.e.
 * strictly prior to the current point.
 *
 * When a window has zero prior observations, its median/delta/percent are
 * null but sampleSize is 0, so the UI can show "No baseline yet" instead
 * of hiding the badge entirely.
 */
export function computeDeltas(series: TimedValue[]): DeltaSummary | null {
  if (series.length === 0) return null

  // Sort ascending by date so the last element is "current".
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date))
  const current = sorted[sorted.length - 1]
  if (!Number.isFinite(current.value)) return null

  const prior = sorted.slice(0, -1)

  const windows: DeltaWindow[] = WINDOW_DEFS.map(({ label, days }) => {
    const inWindow = prior.filter((p) => {
      const diff = daysBetween(p.date, current.date)
      return diff > 0 && diff <= days
    })
    const values = inWindow.map((p) => p.value).filter((v) => Number.isFinite(v))
    const med = median(values)
    const delta = med === null ? null : current.value - med
    const percent =
      med === null || med === 0 ? null : ((current.value - med) / med) * 100

    return {
      label,
      days,
      median: med,
      delta,
      percent,
      sampleSize: values.length,
    }
  })

  return {
    current: current.value,
    currentDate: current.date,
    windows,
  }
}

/**
 * Format a delta for display. Positive numbers get a '+' prefix, zero
 * shows as '0', negatives keep their minus. Precision is 1 decimal.
 */
export function formatDelta(delta: number | null): string {
  if (delta === null || Number.isNaN(delta)) return 'no baseline'
  if (delta === 0) return '0'
  const rounded = Math.round(delta * 10) / 10
  return rounded > 0 ? `+${rounded}` : `${rounded}`
}

/**
 * Format a percent delta for display. Returns e.g. '+12%' or '-4%'.
 * Returns 'no baseline' when percent is null.
 */
export function formatPercent(percent: number | null): string {
  if (percent === null || Number.isNaN(percent)) return 'no baseline'
  const rounded = Math.round(percent)
  if (rounded === 0) return '0%'
  return rounded > 0 ? `+${rounded}%` : `${rounded}%`
}
