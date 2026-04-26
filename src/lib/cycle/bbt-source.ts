/**
 * Unified BBT (Basal Body Temperature) source.
 *
 * Wave 1 of the cycle deep rebuild (audit 2026-04-23). Cycle-aware surfaces
 * historically pulled BBT from three independent silos and disagreed on
 * which value applied to a given date. This module is the one place that
 * merges them, in a documented priority order, into a single normalized
 * stream that downstream cycle code (cover-line, signal-fusion,
 * load-cycle-context) consumes.
 *
 * Priority (highest wins per date):
 *   1. oura_daily.body_temp_deviation -- automatic from the Oura Ring sync.
 *      The reading is a deviation from the ring's personal baseline; it is
 *      not an absolute temperature. NC's published methodology treats this
 *      device-relative deviation as the canonical signal for users on a
 *      wearable, since absolute temperature varies by device.
 *   2. nc_imported.temperature -- absolute Celsius readings from the user's
 *      historical Natural Cycles export. Used for any date older than the
 *      Oura connection or any night where Oura did not capture data.
 *   3. health_profile.bbt_log entries -- manual oral-thermometer entries.
 *      Stored as absolute Celsius (with Fahrenheit mirror).
 *
 * All sources convert to a common shape: { date, value, kind, source }.
 *   - `kind: 'absolute'` carries an absolute Celsius temperature.
 *   - `kind: 'deviation'` carries a deviation from the user's personal
 *     baseline (units: Celsius, can be negative).
 * Cover-line maths handles each kind separately; do not mix without
 * conversion. The two kinds are NOT directly comparable.
 *
 * The function is async because Supabase reads are async; tests inject
 * fixtures via the pure helpers exported alongside.
 *
 * IMPORTANT: this module deliberately does NOT consult cervical mucus,
 * sleep, mood, or any other tracker. NC's published algorithm relies on
 * temperature + LH + period only; everything else is journaling.
 */

import { createServiceClient } from '@/lib/supabase'
import { runScopedQuery } from '@/lib/auth/scope-query'
import { loadBbtLog, type BbtEntry } from './bbt-log'

export type BbtKind = 'absolute' | 'deviation'

export interface BbtReading {
  /** ISO date YYYY-MM-DD. */
  date: string
  /**
   * Temperature value. When kind='absolute', this is degrees Celsius. When
   * kind='deviation', this is the deviation from the user's personal
   * baseline in degrees Celsius (can be negative).
   */
  value: number
  kind: BbtKind
  source: 'oura' | 'nc_import' | 'manual'
}

export interface BbtSourceFixtures {
  oura?: ReadonlyArray<{ date: string; body_temp_deviation: number | null }>
  ncImported?: ReadonlyArray<{ date: string; temperature: number | null }>
  manual?: ReadonlyArray<BbtEntry>
}

/**
 * Pure helper: merge three BBT silos into a single, sorted, deduplicated
 * stream. When a date appears in multiple silos, priority order wins
 * (Oura > nc_import > manual). Exported for tests.
 */
export function mergeBbtSources(input: BbtSourceFixtures): BbtReading[] {
  const byDate = new Map<string, BbtReading>()

  // Lowest priority first; later writes overwrite. This way Oura's
  // deviation is used when present, otherwise NC's absolute, otherwise
  // manual.
  for (const m of input.manual ?? []) {
    if (!isIsoDate(m.date)) continue
    if (!Number.isFinite(m.temp_c)) continue
    byDate.set(m.date, {
      date: m.date,
      value: m.temp_c,
      kind: 'absolute',
      source: 'manual',
    })
  }

  for (const r of input.ncImported ?? []) {
    if (!isIsoDate(r.date)) continue
    if (r.temperature == null || !Number.isFinite(Number(r.temperature))) continue
    const v = Number(r.temperature)
    // NC exports temperatures in Celsius for users on metric; older or US
    // exports may emit Fahrenheit. Detect: anything > 50 is plausibly F
    // (human body F is ~96-99); anything in 30-45 is C.
    let celsius = v
    if (v > 50 && v < 113) celsius = (v - 32) * (5 / 9)
    if (celsius < 30 || celsius > 45) continue
    byDate.set(r.date, {
      date: r.date,
      value: Number(celsius.toFixed(2)),
      kind: 'absolute',
      source: 'nc_import',
    })
  }

  for (const r of input.oura ?? []) {
    if (!isIsoDate(r.date)) continue
    if (r.body_temp_deviation == null) continue
    const v = Number(r.body_temp_deviation)
    if (!Number.isFinite(v)) continue
    byDate.set(r.date, {
      date: r.date,
      value: Number(v.toFixed(3)),
      kind: 'deviation',
      source: 'oura',
    })
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Async wrapper that pulls live data from Supabase and merges it. Pass a
 * `since` ISO date to bound the Oura/NC queries; defaults to all-time
 * (the BBT log is small enough that this is cheap).
 */
export async function loadBbtSource(opts?: {
  since?: string
  until?: string
  /**
   * Supabase auth user id to scope the BBT silos to. Pre-migration the
   * filter falls back to unfiltered (single-user view); post-migration
   * the filter is enforced and a wrong / missing id returns empty.
   */
  userId?: string | null
}): Promise<BbtReading[]> {
  const sb = createServiceClient()
  const since = opts?.since ?? '1970-01-01'
  const until = opts?.until ?? new Date().toISOString().slice(0, 10)
  const userId = opts?.userId

  const [ouraRes, ncRes, manualLog] = await Promise.all([
    runScopedQuery({
      table: 'oura_daily',
      userId,
      withFilter: () =>
        sb
          .from('oura_daily')
          .select('date, body_temp_deviation')
          .gte('date', since)
          .lte('date', until)
          .eq('user_id', userId as string)
          .order('date', { ascending: true }),
      withoutFilter: () =>
        sb
          .from('oura_daily')
          .select('date, body_temp_deviation')
          .gte('date', since)
          .lte('date', until)
          .order('date', { ascending: true }),
    }),
    runScopedQuery({
      table: 'nc_imported',
      userId,
      withFilter: () =>
        sb
          .from('nc_imported')
          .select('date, temperature')
          .gte('date', since)
          .lte('date', until)
          .eq('user_id', userId as string)
          .order('date', { ascending: true }),
      withoutFilter: () =>
        sb
          .from('nc_imported')
          .select('date, temperature')
          .gte('date', since)
          .lte('date', until)
          .order('date', { ascending: true }),
    }),
    loadBbtLog(),
  ])

  return mergeBbtSources({
    oura: (ouraRes.data ?? []) as Array<{ date: string; body_temp_deviation: number | null }>,
    ncImported: (ncRes.data ?? []) as Array<{ date: string; temperature: number | null }>,
    manual: manualLog.entries,
  })
}

function isIsoDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
}
