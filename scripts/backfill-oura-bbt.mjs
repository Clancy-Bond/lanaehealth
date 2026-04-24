/**
 * One-off backfill: populate oura_daily.body_temp_deviation from raw_json
 * for rows where the column is NULL but the payload contains a
 * temperature_deviation or temperature_trend_deviation.
 *
 * Context (Wave 1 cycle deep rebuild, 2026-04-23):
 *   Oura's readiness response exposes two temperature fields:
 *     - temperature_deviation: absolute, often null.
 *     - temperature_trend_deviation: smoothed trend, more stable.
 *   The sync route now falls back to the trend when the absolute is
 *   missing. This script applies the same fallback to historical rows
 *   that were written before the fix.
 *
 * Run:
 *   node --env-file=.env.local scripts/backfill-oura-bbt.mjs
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the
 * environment. Does not delete or modify any other columns; only fills
 * the NULL body_temp_deviation values.
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const sb = createClient(url, key)

const all = []
let from = 0
const page = 1000
while (true) {
  const { data, error } = await sb
    .from('oura_daily')
    .select('date, body_temp_deviation, raw_json')
    .order('date', { ascending: false })
    .range(from, from + page - 1)
  if (error) {
    console.error(error)
    process.exit(1)
  }
  all.push(...data)
  if (data.length < page) break
  from += page
}

const updates = []
for (const r of all) {
  if (r.body_temp_deviation != null) continue
  const rj = r.raw_json ?? {}
  const dev = rj?.oura?.readiness?.temperature_deviation ?? rj?.readiness?.temperature_deviation
  const trend =
    rj?.oura?.readiness?.temperature_trend_deviation ??
    rj?.readiness?.temperature_trend_deviation
  const v =
    dev != null && Number.isFinite(Number(dev))
      ? Number(dev)
      : trend != null && Number.isFinite(Number(trend))
        ? Number(trend)
        : null
  if (v != null) updates.push({ date: r.date, value: v })
}

console.log(`Fetched ${all.length} rows; ${updates.length} candidates for backfill.`)
let success = 0
for (const u of updates) {
  const { error } = await sb
    .from('oura_daily')
    .update({ body_temp_deviation: u.value })
    .eq('date', u.date)
  if (error) {
    console.error(`Update failed for ${u.date}:`, error.message)
  } else {
    success++
  }
}
console.log(`Backfilled ${success}/${updates.length} rows.`)
