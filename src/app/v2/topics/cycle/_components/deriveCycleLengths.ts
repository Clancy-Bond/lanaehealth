/*
 * Section-local helper: derive last-6-cycles length summary for the
 * /v2/topics/cycle deep-dive.
 *
 * Ported verbatim from the legacy /topics/cycle page (see
 * src/app/topics/cycle/page.tsx) so the two surfaces agree on the
 * same numbers. The logic:
 *   1. Union menstrual signals from cycle_entries (menstruation=true)
 *      and nc_imported (flow_quantity or menstruation=MENSTRUATION,
 *      SPOTTING excluded).
 *   2. Collapse consecutive menstrual days into one period start.
 *      Legacy uses a gap >= 10 day threshold to identify a NEW cycle
 *      start; that stays here so the numbers match the legacy page.
 *   3. Compute length between consecutive starts. Drop gaps > 60 days
 *      as amenorrhea so one long gap cannot distort the last-6-cycle
 *      view. Return the SHAPE the v2 chart wants
 *      ({start, end, length}) instead of the legacy bare number[].
 *
 * Kept section-local per Session 05 instructions; the authoritative
 * cycle engine lives in src/lib/cycle/ and is locked. If the chart
 * gains clinical obligations later, move this into the engine.
 */
export type CompletedCycle = {
  /** YYYY-MM-DD of the first menstrual day of this cycle. */
  start: string
  /** YYYY-MM-DD of the next period start (which is the END of this cycle). */
  end: string
  /** Cycle length in days (next start minus start). */
  length: number
}

// Raw Supabase rows: menstruation is nullable in cycle_entries on the
// wire even though our write contract sets it. Keep the input shapes
// permissive so the helper can consume .select() results directly.
type CycleRow = {
  date: string
  menstruation: boolean | null
  flow_level: string | null
}
type NcRow = {
  date: string
  menstruation: string | null
  flow_quantity: string | null
}

/**
 * Derive completed cycle lengths. Returns the most-recent-first list
 * matching the order the legacy page used. Filter rule: gaps > 60 days
 * are treated as amenorrhea and dropped from the list.
 */
export function deriveCycleLengths(
  entries: CycleRow[],
  ncImported: NcRow[],
): CompletedCycle[] {
  const fromCycles = entries
    .filter((r) => r.menstruation === true)
    .map((r) => r.date)
  const fromNc = ncImported
    .filter(
      (n) =>
        n.menstruation === 'MENSTRUATION' ||
        (n.flow_quantity != null && n.menstruation !== 'SPOTTING'),
    )
    .map((n) => n.date)

  const periodDays = Array.from(new Set([...fromCycles, ...fromNc])).sort()
  if (periodDays.length < 2) return []

  // Collapse consecutive menstruation days into just the first (start
  // of period). Gap >= 10 days between logged menstrual days is the
  // legacy threshold that separates two cycles.
  const starts: string[] = [periodDays[0]]
  for (let i = 1; i < periodDays.length; i++) {
    const prev = new Date(periodDays[i - 1] + 'T00:00:00').getTime()
    const curr = new Date(periodDays[i] + 'T00:00:00').getTime()
    const gap = Math.round((curr - prev) / 86400000)
    if (gap >= 10) starts.push(periodDays[i])
  }

  const cycles: CompletedCycle[] = []
  for (let i = 1; i < starts.length; i++) {
    const a = new Date(starts[i - 1] + 'T00:00:00').getTime()
    const b = new Date(starts[i] + 'T00:00:00').getTime()
    const length = Math.round((b - a) / 86400000)
    if (length <= 60) {
      cycles.push({ start: starts[i - 1], end: starts[i], length })
    }
  }
  return cycles.reverse()
}
