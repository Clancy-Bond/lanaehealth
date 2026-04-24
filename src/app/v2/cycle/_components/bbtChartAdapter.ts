/*
 * bbtChartAdapter
 *
 * TODO(wave-1): Replace this adapter with src/lib/cycle/bbt-source.ts
 * and src/lib/cycle/cover-line.ts once Wave 1 lands. This file lives
 * under _components on purpose so Wave 3 doesn't touch src/lib/cycle/*.
 *
 * For now we derive a per-cycle reading window and a personal cover
 * line directly from BbtEntry + the cycle context's lastPeriodStart.
 *
 * Cover-line algorithm (placeholder, mirrors Marquette method baseline):
 *   1. Take the last 6 follicular-phase readings prior to any sustained
 *      shift (or the last 6 readings overall if no shift detected).
 *   2. Cover line = max of those 6 readings, plus 0.05°F headroom.
 *
 * This will be replaced by Wave 1's authoritative implementation. The
 * BbtChart component imports types from this file; switching to the
 * Wave 1 module is a drop-in once it ships.
 */
import type { BbtEntry } from '@/lib/cycle/bbt-log'
import type { BbtReading } from './BbtChart'

interface BuildArgs {
  /** All BBT entries the app has on file (any number of cycles). */
  entries: BbtEntry[]
  /** ISO date of the most recent period's first day. Null = unknown. */
  lastPeriodStart: string | null
  /** Set of ISO dates with logged menstrual flow this cycle. */
  periodDates?: Set<string>
}

interface BuildResult {
  readings: BbtReading[]
  coverLine: number | null
}

function isoDiffDays(a: string, b: string): number {
  return Math.floor(
    (Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) /
      (24 * 60 * 60 * 1000),
  )
}

/**
 * Filter BBT entries to the current cycle (>= lastPeriodStart) and map
 * them to the chart's reading shape with a cycleDay derived from the
 * period start.
 */
export function buildBbtChartData({
  entries,
  lastPeriodStart,
  periodDates,
}: BuildArgs): BuildResult {
  if (entries.length === 0 || !lastPeriodStart) {
    return { readings: [], coverLine: null }
  }

  const cycle = entries.filter((e) => e.date >= lastPeriodStart)
  if (cycle.length === 0) return { readings: [], coverLine: null }

  const readings: BbtReading[] = cycle.map((e) => ({
    date: e.date,
    cycleDay: isoDiffDays(e.date, lastPeriodStart) + 1,
    temp_f: e.temp_f,
    isPeriodDay: periodDates ? periodDates.has(e.date) : false,
  }))

  // Personal cover line: take up to 6 follicular-phase readings (cycle
  // day <= 13) and use their max + 0.05F as the threshold. When fewer
  // than 4 follicular readings exist, the cover line is too noisy to
  // trust and we return null so the chart renders in neutral color.
  const follicular = readings.filter((r) => r.cycleDay <= 13).map((r) => r.temp_f)
  const coverLine =
    follicular.length >= 4
      ? Number((Math.max(...follicular.slice(-6)) + 0.05).toFixed(2))
      : null

  return { readings, coverLine }
}
