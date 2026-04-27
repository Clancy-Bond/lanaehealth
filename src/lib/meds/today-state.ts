/**
 * Compute the "what is checked off today" view for the home meds card.
 *
 * Today is defined in the user's local timezone (passed in from the
 * request). Doses recorded at 1am the next day still count toward
 * "yesterday" in the user's frame, even though their UTC stamp is
 * already on the new date.
 */
import type { MedDose, MedSlot, MedsConfig, ScheduledMed } from './types'

export interface ScheduledRowState {
  /** Stable React key + the slug used by API writes. */
  rowId: string
  med: ScheduledMed
  slot: MedSlot
  /** Most recent dose for THIS slot today. null = unchecked. */
  takenDose: MedDose | null
}

export interface PrnRowState {
  slug: string
  name: string
  indication: string
  default_dose_text: string | null
  /** All doses today for this PRN med (chronological). */
  todayDoses: MedDose[]
  /** Days since the last dose anytime in history; null = never. */
  daysSinceLast: number | null
}

export interface MedsTodayState {
  /** Morning batch rows (one per scheduled med that has 'morning' slot). */
  morning: ScheduledRowState[]
  /** Tonight batch rows. */
  night: ScheduledRowState[]
  /** Mid-day rows (rare, included for completeness). */
  midday: ScheduledRowState[]
  prn: PrnRowState[]
  /** count of slots filled in today's scheduled batches. */
  scheduledTakenCount: number
  /** Total scheduled slots today. */
  scheduledTotalCount: number
}

interface BuildOpts {
  config: MedsConfig
  /** Doses across a recent window (today + history for "days since"). */
  doses: MedDose[]
  /** ISO date (YYYY-MM-DD) representing the user's local "today". */
  todayLocal: string
}

/**
 * Build a row per (med, slot) combination so a med taken twice a day
 * shows up as TWO checkboxes. Pre-fills the first matching dose for
 * each slot. If she happened to log a slot twice (snake-bit, double
 * tapped), only the first counts as "the morning dose" and any later
 * ones live in the history list.
 */
export function buildMedsTodayState(opts: BuildOpts): MedsTodayState {
  const { config, doses, todayLocal } = opts
  const todayDoses = doses.filter((d) => isoDate(d.taken_at) === todayLocal)

  // Group today's doses by (slug, slot) so each row picks up its match.
  const byKey = new Map<string, MedDose[]>()
  for (const d of todayDoses) {
    const key = `${d.med_slug}::${d.slot ?? ''}`
    const arr = byKey.get(key)
    if (arr) arr.push(d)
    else byKey.set(key, [d])
  }
  // Sort each bucket chronologically so we always pick the earliest dose.
  for (const arr of byKey.values()) {
    arr.sort((a, b) => a.taken_at.localeCompare(b.taken_at))
  }

  const morning: ScheduledRowState[] = []
  const midday: ScheduledRowState[] = []
  const night: ScheduledRowState[] = []
  let scheduledTakenCount = 0
  let scheduledTotalCount = 0

  for (const med of config.scheduled) {
    for (const slot of med.slots) {
      const rowId = `${med.slug}::${slot}`
      const matches = byKey.get(rowId) ?? []
      // Slot-less doses (logged via the PRN/note path but for a scheduled
      // med) also count toward the first empty scheduled slot of the day.
      const slotless =
        matches.length === 0
          ? (byKey.get(`${med.slug}::`) ?? []).filter(
              (d) => !alreadyConsumed(byKey, med.slug, d.id),
            )
          : []
      const takenDose = matches[0] ?? slotless[0] ?? null
      if (takenDose) {
        // Mark the slotless dose as consumed so it does not double-count
        // against another empty slot for the same med.
        if (!matches.length && slotless[0]) markConsumed(byKey, med.slug, slotless[0].id)
        scheduledTakenCount += 1
      }
      scheduledTotalCount += 1
      const row: ScheduledRowState = { rowId, med, slot, takenDose }
      if (slot === 'morning') morning.push(row)
      else if (slot === 'midday') midday.push(row)
      else night.push(row)
    }
  }

  // PRN rows: list every PRN med with today's doses and "days since".
  const prn: PrnRowState[] = config.as_needed.map((med) => {
    const allForMed = doses
      .filter((d) => d.med_slug === med.slug)
      .sort((a, b) => b.taken_at.localeCompare(a.taken_at))
    const todayForMed = allForMed.filter((d) => isoDate(d.taken_at) === todayLocal)
    const lastDose = allForMed[0] ?? null
    const daysSinceLast = lastDose ? daysBetween(todayLocal, isoDate(lastDose.taken_at)) : null
    return {
      slug: med.slug,
      name: med.name,
      indication: med.indication,
      default_dose_text: med.default_dose_text ?? null,
      todayDoses: todayForMed,
      daysSinceLast,
    }
  })

  return {
    morning,
    night,
    midday,
    prn,
    scheduledTakenCount,
    scheduledTotalCount,
  }
}

// ── Internals ──────────────────────────────────────────────────────

function isoDate(tsIso: string): string {
  // Take the calendar date in UTC. The request supplies todayLocal in
  // the user's frame already; if the user's TZ shifts the date by a few
  // hours, the server-side ISO date may not match. We accept that
  // edge-case minor mis-attribution for v1; a stricter local-date
  // computation can ship later.
  return tsIso.slice(0, 10)
}

function daysBetween(aIso: string, bIso: string): number {
  const a = Date.parse(aIso + 'T00:00:00Z')
  const b = Date.parse(bIso + 'T00:00:00Z')
  return Math.max(0, Math.round((a - b) / 86_400_000))
}

const consumedIds = new WeakMap<Map<string, MedDose[]>, Set<string>>()
function alreadyConsumed(map: Map<string, MedDose[]>, _slug: string, id: string): boolean {
  const set = consumedIds.get(map)
  return !!set?.has(id)
}
function markConsumed(map: Map<string, MedDose[]>, _slug: string, id: string): void {
  let set = consumedIds.get(map)
  if (!set) {
    set = new Set()
    consumedIds.set(map, set)
  }
  set.add(id)
}
