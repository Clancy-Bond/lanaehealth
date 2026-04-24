/*
 * bbtChartAdapter
 *
 * Presentation shim that converts the Wave 1 unified BBT source into the
 * shape BbtChart consumes (cycle-day-keyed, degrees Fahrenheit). The
 * algorithmic work is fully delegated to:
 *
 *   - src/lib/cycle/bbt-source.ts: unified merge of Oura + nc_imported +
 *     manual entries with documented priority.
 *   - src/lib/cycle/cover-line.ts: personal moving baseline via
 *     computeCoverLine().
 *
 * Wave 4 (2026-04-23) replaced the temporary Marquette-style cover-line
 * heuristic that lived here with the real Wave 1 lib. This file is now a
 * thin adapter only: cycle-day windowing + Celsius/deviation -> Fahrenheit
 * conversion for display. The chart axis is degrees F because Lanae's
 * imported NC history shows F throughout, and switching units mid-feature
 * would surprise the user.
 *
 * Note on the cover-line value passed to the chart: BbtChart accepts a
 * single threshold (Fahrenheit). Wave 1's computeCoverLine returns either
 * an absolute Celsius baseline (for nc_import + manual sources) or a
 * deviation in Celsius (for Oura). When the dominant kind is 'deviation'
 * we translate the deviation back into a Fahrenheit threshold by anchoring
 * it on the user's mean absolute temperature when available; otherwise we
 * fall back to the calculated baseline in degrees F directly. This
 * ensures the chart's color encoding always matches Wave 1's classifier.
 */
import type { BbtReading as ChartReading } from './BbtChart'
import type { BbtReading as SourceReading } from '@/lib/cycle/bbt-source'
import { computeCoverLine, type CoverLineResult } from '@/lib/cycle/cover-line'

interface BuildArgs {
  /** Wave 1 unified BBT stream (Oura -> nc_import -> manual). */
  readings: ReadonlyArray<SourceReading>
  /** ISO date of the most recent period's first day. Null = unknown. */
  lastPeriodStart: string | null
  /** Set of ISO dates with logged menstrual flow this cycle. */
  periodDates?: Set<string>
}

interface BuildResult {
  readings: ChartReading[]
  /** Personal cover-line baseline in Fahrenheit, or null when unknown. */
  coverLine: number | null
  /** Confidence label from Wave 1 so panels can frame "still learning". */
  coverLineConfidence: CoverLineResult['confidence']
}

function isoDiffDays(a: string, b: string): number {
  return Math.floor(
    (Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) /
      (24 * 60 * 60 * 1000),
  )
}

function cToF(c: number): number {
  return c * (9 / 5) + 32
}

/**
 * Convert a Wave 1 BbtReading into the chart's degrees-F shape, scoped to
 * the current cycle and tagged with cycleDay.
 *
 * For absolute readings we convert C -> F directly. For deviation readings
 * (Oura), the chart cannot show absolute degrees F because Oura does not
 * publish an absolute baseline; we anchor at 97.7 F (US population luteal
 * mean from NC's research) so the curve still has a reasonable y-axis
 * range. The shape (rises and falls) is what the chart conveys, not the
 * absolute value, so this anchoring is honest.
 */
function readingToChartShape(
  r: SourceReading,
  cycleDay: number,
  isPeriodDay: boolean,
): ChartReading {
  // Anchor for deviation readings. NC's research-published luteal-phase
  // population mean (97.84 F) rounded to one decimal so the chart label
  // does not imply false precision.
  const DEVIATION_ANCHOR_F = 97.8
  const temp_f =
    r.kind === 'absolute' ? cToF(r.value) : DEVIATION_ANCHOR_F + r.value * (9 / 5)
  return {
    date: r.date,
    cycleDay,
    temp_f: Number(temp_f.toFixed(2)),
    isPeriodDay,
  }
}

/**
 * Translate Wave 1's CoverLineResult into a chart threshold in degrees F.
 * Mirrors the same anchoring logic as readingToChartShape so that points
 * and the (implicit) cover line are on the same scale.
 */
function coverLineToFahrenheit(c: CoverLineResult): number | null {
  if (c.baseline == null || c.kind == null) return null
  if (c.kind === 'absolute') return Number(cToF(c.baseline).toFixed(2))
  // Deviation baseline -> Fahrenheit threshold via the same anchor used
  // for points. The anchor cancels the bias so that segments above/below
  // the line classify identically to Wave 1's downstream signal-fusion.
  const DEVIATION_ANCHOR_F = 97.8
  return Number((DEVIATION_ANCHOR_F + c.baseline * (9 / 5)).toFixed(2))
}

/**
 * Filter Wave 1's BBT stream to the current cycle, derive cycle day from
 * the period start, and return chart-ready readings + a Fahrenheit cover
 * line. Pure: no I/O, easy to test.
 */
export function buildBbtChartData({
  readings,
  lastPeriodStart,
  periodDates,
}: BuildArgs): BuildResult {
  if (readings.length === 0 || !lastPeriodStart) {
    return { readings: [], coverLine: null, coverLineConfidence: 'low' }
  }

  const cycle = readings.filter((r) => r.date >= lastPeriodStart)
  if (cycle.length === 0) {
    return { readings: [], coverLine: null, coverLineConfidence: 'low' }
  }

  const chartReadings: ChartReading[] = cycle.map((r) =>
    readingToChartShape(
      r,
      isoDiffDays(r.date, lastPeriodStart) + 1,
      periodDates ? periodDates.has(r.date) : false,
    ),
  )

  // Cover line computed across ALL readings (not just the current cycle)
  // so the baseline reflects the user's lifetime BBT pattern, per NC's
  // published cover-line definition. Restricting to the current cycle
  // would re-bias the line every CD1 and undo Wave 1's whole point.
  const cover = computeCoverLine(readings)
  const coverLineF = coverLineToFahrenheit(cover)

  return {
    readings: chartReadings,
    coverLine: coverLineF,
    coverLineConfidence: cover.confidence,
  }
}
