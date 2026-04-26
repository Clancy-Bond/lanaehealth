/**
 * Pure stat helpers for the one-page printable doctor handoff.
 *
 * Pattern source: bearable.app's printable worksheets - short,
 * print-friendly, summary-first. The doctor wants the 7-day
 * numbers in one glance, no app required.
 *
 * The numbers themselves come from the existing daily_logs +
 * pain_points tables. This module is the pure shaping layer so
 * the page doesn't carry inline math, and so the rounding stays
 * unit-tested.
 */

/**
 * Mean of a list of numbers, rounded to one decimal so the printed
 * cell stays compact. Returns null for an empty input so the page
 * can render a dash without a divide-by-zero hazard.
 */
export function meanOf(values: ReadonlyArray<number>): number | null {
  if (values.length === 0) return null
  const sum = values.reduce((acc, n) => acc + n, 0)
  const raw = sum / values.length
  return Math.round(raw * 10) / 10
}

/**
 * Format a possibly-null number as a printable cell. Used for the
 * 0-to-10 stat table so missing data reads as "-" (an em-dash style
 * single character; per repo rule we use the dash glyph not the
 * em-dash markdown).
 */
export function fmtCell(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '-'
  return value.toFixed(1)
}

export interface SevenDayStat {
  /** Display label, e.g. "Pain". */
  label: string
  /** 7-day mean, rounded; null when no data. */
  mean: number | null
  /** Number of days that contributed to the mean. */
  days: number
}

/**
 * Build a SevenDayStat for a single metric. Caller passes in the
 * raw daily values (length 7 ideally; missing days are simply absent
 * from the array). The returned `days` is the count of values used.
 */
export function buildSevenDayStat(label: string, values: ReadonlyArray<number>): SevenDayStat {
  return {
    label,
    mean: meanOf(values),
    days: values.length,
  }
}
