/**
 * Sleep tab data-fetching helpers.
 *
 * All reads flow through these functions so the five sleep routes and
 * three home widgets share one canonical query shape. Callers pass in
 * a Supabase service client so the helper is usable from both server
 * components and API routes.
 *
 * Query shape:
 *   - Last-night / readiness / HRV rings want the most recent row plus
 *     a 28-day tail for baseline math.
 *   - The /patterns/sleep chart wants 30 days of score + HRV + RHR.
 *   - The /sleep/stages view wants yesterday-or-most-recent.
 *
 * Every helper returns rows in ascending-date order so charts can
 * render without a second sort.
 */

import { format, subDays } from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SleepRingRow {
  date: string;
  sleep_score: number | null;
  readiness_score: number | null;
  sleep_duration: number | null;
  deep_sleep_min: number | null;
  rem_sleep_min: number | null;
  hrv_avg: number | null;
  resting_hr: number | null;
  body_temp_deviation: number | null;
  respiratory_rate: number | null;
  synced_at: string | null;
}

export interface SleepWindow {
  rows: SleepRingRow[];
  todayRow: SleepRingRow | null;
  latestRow: SleepRingRow | null;
  latestDate: string | null;
  latestSyncedAt: string | null;
}

/**
 * Fetch an inclusive date window of oura_daily rows with every sleep-
 * relevant column selected. The window is returned in ascending date
 * order so charts can render top-to-bottom left-to-right without a
 * secondary sort on the client.
 */
export async function fetchSleepWindow(
  supabase: SupabaseClient,
  opts: { today: string; days: number },
): Promise<SleepWindow> {
  const start = format(subDays(new Date(opts.today + 'T00:00:00'), Math.max(1, opts.days - 1)), 'yyyy-MM-dd');
  const { data } = await supabase
    .from('oura_daily')
    .select(
      'date, sleep_score, readiness_score, sleep_duration, deep_sleep_min, rem_sleep_min, hrv_avg, resting_hr, body_temp_deviation, respiratory_rate, synced_at',
    )
    .gte('date', start)
    .lte('date', opts.today)
    .order('date', { ascending: true });

  const rows = (data ?? []) as SleepRingRow[];
  const todayRow = rows.find((r) => r.date === opts.today) ?? null;
  const latestRow = rows.length > 0 ? rows[rows.length - 1] : null;
  return {
    rows,
    todayRow,
    latestRow,
    latestDate: latestRow?.date ?? null,
    latestSyncedAt: latestRow?.synced_at ?? null,
  };
}

/**
 * Fetch the last N oura_daily rows regardless of date. Used when the
 * user has a sync gap longer than the "today - days" window (e.g. the
 * ring battery died). Always returns ascending date order.
 */
export async function fetchRecentSleep(
  supabase: SupabaseClient,
  limit: number,
): Promise<SleepRingRow[]> {
  const { data } = await supabase
    .from('oura_daily')
    .select(
      'date, sleep_score, readiness_score, sleep_duration, deep_sleep_min, rem_sleep_min, hrv_avg, resting_hr, body_temp_deviation, respiratory_rate, synced_at',
    )
    .order('date', { ascending: false })
    .limit(limit);
  const rows = ((data ?? []) as SleepRingRow[]).slice().reverse();
  return rows;
}

/**
 * Split a 29-row window into (priorRows, todayRow) pairs expected by the
 * baseline + contributor helpers. Pure; no I/O.
 */
export function splitWindowAtToday(
  rows: SleepRingRow[],
  today: string,
): { priorRows: SleepRingRow[]; todayRow: SleepRingRow | null } {
  const todayRow = rows.find((r) => r.date === today) ?? null;
  const priorRows = rows.filter((r) => r.date !== today);
  return { priorRows, todayRow };
}

/**
 * Average of a field across a set of rows, ignoring nulls. Null if no
 * usable samples. Kept inline because `reduce` + filter noise here
 * matters for readability.
 */
export function avgOf(
  rows: SleepRingRow[],
  pick: (r: SleepRingRow) => number | null,
): number | null {
  const vals = rows.map(pick).filter((v): v is number => v !== null && Number.isFinite(v));
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
