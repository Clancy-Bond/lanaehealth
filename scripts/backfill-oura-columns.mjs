/**
 * One-off backfill: populate Wave 1 (audit) Oura columns on oura_daily
 * from raw_json for rows where the column is NULL but the payload
 * contains the value.
 *
 * Targets columns added in migrations 030-034:
 *   - sleep_latency_min                (raw_json.oura.sleep_detail.latency / 60)
 *   - stress_high_min                  (raw_json.oura.stress.stress_high)
 *   - recovery_high_min                (raw_json.oura.stress.recovery_high)
 *   - breathing_disturbance_index      (raw_json.oura.spo2.breathing_disturbance_index)
 *   - activity_score                   (raw_json.oura.daily_activity.score)
 *   - sedentary_min                    (raw_json.oura.daily_activity.sedentary_time / 60)
 *   - low_activity_min                 (raw_json.oura.daily_activity.low_activity_time / 60)
 *   - medium_activity_min              (raw_json.oura.daily_activity.medium_activity_time / 60)
 *   - high_activity_min                (raw_json.oura.daily_activity.high_activity_time / 60)
 *   - hrv_max                          (max of raw_json.oura.sleep_detail.hrv.items)
 *
 * Safety / Zero Data Loss:
 *   - Pure additive update. Each column is touched only when its
 *     current value is null AND the source value is present in raw_json.
 *   - No row is ever deleted, no column outside the target set is read
 *     or written, no raw_json key is touched.
 *   - Idempotent: re-running the script after a successful run is a no-op
 *     because the per-column NULL check filters every previously-filled
 *     row.
 *
 * Run:
 *   node --env-file=.env.local scripts/backfill-oura-columns.mjs
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the
 * environment.
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const sb = createClient(url, key)

/**
 * Compute the maximum HRV value from Oura's intraday 5-minute series.
 * Mirrors the same helper in src/app/api/oura/sync/route.ts so the
 * historical backfill matches forward-looking sync behaviour exactly.
 */
function computeHrvMax(sleepDetail) {
  const detail = sleepDetail?.hrv
  if (!detail || typeof detail !== 'object') return null
  const items = detail.items
  if (!Array.isArray(items) || items.length === 0) return null
  let max = null
  for (const item of items) {
    if (typeof item !== 'number' || !Number.isFinite(item)) continue
    if (max === null || item > max) max = item
  }
  if (max === null) return null
  return Math.round(max)
}

function secondsToMinutes(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.round(value / 60)
}

function intOrNull(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.round(value)
}

// Pull all rows in pages, then compute updates locally so we never write
// during the read pass.
const all = []
let from = 0
const page = 1000
while (true) {
  const { data, error } = await sb
    .from('oura_daily')
    .select(
      'date, sleep_latency_min, stress_high_min, recovery_high_min, breathing_disturbance_index, activity_score, sedentary_min, low_activity_min, medium_activity_min, high_activity_min, hrv_max, raw_json',
    )
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

const counters = {
  sleep_latency_min: 0,
  stress_high_min: 0,
  recovery_high_min: 0,
  breathing_disturbance_index: 0,
  activity_score: 0,
  sedentary_min: 0,
  low_activity_min: 0,
  medium_activity_min: 0,
  high_activity_min: 0,
  hrv_max: 0,
}

const updates = []
for (const r of all) {
  const ouraRaw = r.raw_json?.oura ?? {}
  const sleepDetail = ouraRaw.sleep_detail ?? {}
  const stress = ouraRaw.stress ?? {}
  const spo2 = ouraRaw.spo2 ?? {}
  const activity = ouraRaw.daily_activity ?? {}

  const patch = {}

  if (r.sleep_latency_min == null) {
    const v = secondsToMinutes(sleepDetail.latency)
    if (v != null) {
      patch.sleep_latency_min = v
      counters.sleep_latency_min++
    }
  }

  if (r.stress_high_min == null) {
    const v = intOrNull(stress.stress_high)
    if (v != null) {
      patch.stress_high_min = v
      counters.stress_high_min++
    }
  }

  if (r.recovery_high_min == null) {
    const v = intOrNull(stress.recovery_high)
    if (v != null) {
      patch.recovery_high_min = v
      counters.recovery_high_min++
    }
  }

  if (r.breathing_disturbance_index == null) {
    const v = intOrNull(spo2.breathing_disturbance_index)
    if (v != null) {
      patch.breathing_disturbance_index = v
      counters.breathing_disturbance_index++
    }
  }

  if (r.activity_score == null) {
    const v = intOrNull(activity.score)
    if (v != null) {
      patch.activity_score = v
      counters.activity_score++
    }
  }

  if (r.sedentary_min == null) {
    const v = secondsToMinutes(activity.sedentary_time)
    if (v != null) {
      patch.sedentary_min = v
      counters.sedentary_min++
    }
  }

  if (r.low_activity_min == null) {
    const v = secondsToMinutes(activity.low_activity_time)
    if (v != null) {
      patch.low_activity_min = v
      counters.low_activity_min++
    }
  }

  if (r.medium_activity_min == null) {
    const v = secondsToMinutes(activity.medium_activity_time)
    if (v != null) {
      patch.medium_activity_min = v
      counters.medium_activity_min++
    }
  }

  if (r.high_activity_min == null) {
    const v = secondsToMinutes(activity.high_activity_time)
    if (v != null) {
      patch.high_activity_min = v
      counters.high_activity_min++
    }
  }

  if (r.hrv_max == null) {
    const v = computeHrvMax(sleepDetail)
    if (v != null) {
      patch.hrv_max = v
      counters.hrv_max++
    }
  }

  if (Object.keys(patch).length > 0) {
    updates.push({ date: r.date, patch })
  }
}

console.log(`Fetched ${all.length} rows; ${updates.length} need updates.`)
console.log('Per-column candidate counts:', counters)

let success = 0
let failed = 0
for (const u of updates) {
  const { error } = await sb.from('oura_daily').update(u.patch).eq('date', u.date)
  if (error) {
    console.error(`Update failed for ${u.date}:`, error.message)
    failed++
  } else {
    success++
  }
}
console.log(`Backfilled ${success}/${updates.length} rows (${failed} failures).`)
