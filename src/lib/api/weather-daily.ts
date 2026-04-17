/**
 * Data access layer for weather_daily.
 *
 * Read-only after insert (no row mutations). Upsert by date on sync so
 * re-running the cron is idempotent. Returns raw rows shaped by migration
 * 015 (patient_id, location_lat/lon, temp_high/low_c, humidity_mean,
 * pressure_mean_hpa, pressure_change_24h, wind_mean_kmh, precipitation_mm,
 * raw_json, synced_at).
 *
 * Ref: docs/plans/2026-04-16-wave-2a-briefs.md (A3)
 * Ref: docs/competitive/flaredown/implementation-notes.md (Feature 3)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import {
  computePressureChange24h,
  type WeatherDailyRecord,
} from '@/lib/weather'

export interface WeatherDailyRow {
  date: string
  patient_id: string
  location_lat: number
  location_lon: number
  temp_high_c: number | null
  temp_low_c: number | null
  humidity_mean: number | null
  pressure_mean_hpa: number | null
  pressure_change_24h: number | null
  wind_mean_kmh: number | null
  precipitation_mm: number | null
  raw_json: Record<string, unknown> | null
  synced_at: string | null
}

export interface UpsertOptions {
  patientId?: string
  latitude?: number
  longitude?: number
  client?: SupabaseClient
}

const DEFAULT_PATIENT = 'lanae'
// Kailua, HI - Lanae's location
const DEFAULT_LAT = 21.392
const DEFAULT_LON = -157.739

/**
 * Get stored weather rows for a date range, ordered ascending.
 */
export async function getWeatherRange(
  startDate: string,
  endDate: string,
  options: { patientId?: string; client?: SupabaseClient } = {}
): Promise<WeatherDailyRow[]> {
  const client = options.client ?? defaultClient
  const patientId = options.patientId ?? DEFAULT_PATIENT

  const { data, error } = await client
    .from('weather_daily')
    .select(
      'date, patient_id, location_lat, location_lon, temp_high_c, temp_low_c, humidity_mean, pressure_mean_hpa, pressure_change_24h, wind_mean_kmh, precipitation_mm, raw_json, synced_at'
    )
    .eq('patient_id', patientId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })

  if (error) throw new Error(`weather_daily read failed: ${error.message}`)
  return (data ?? []) as WeatherDailyRow[]
}

/**
 * Get the most recent stored weather row strictly before `beforeDate`, or
 * null if none. Used to compute pressure_change_24h when a new row lands.
 */
export async function getPriorPressure(
  beforeDate: string,
  options: { patientId?: string; client?: SupabaseClient } = {}
): Promise<number | null> {
  const client = options.client ?? defaultClient
  const patientId = options.patientId ?? DEFAULT_PATIENT

  const { data, error } = await client
    .from('weather_daily')
    .select('pressure_mean_hpa')
    .eq('patient_id', patientId)
    .lt('date', beforeDate)
    .not('pressure_mean_hpa', 'is', null)
    .order('date', { ascending: false })
    .limit(1)

  if (error) throw new Error(`weather_daily prior read failed: ${error.message}`)
  const row = data?.[0] as { pressure_mean_hpa: number | null } | undefined
  return row?.pressure_mean_hpa ?? null
}

export interface UpsertResult {
  inserted: number
  rows: WeatherDailyRow[]
}

/**
 * Convert fetched Open-Meteo records into weather_daily rows and upsert
 * them by date. Computes pressure_change_24h using the immediately
 * preceding row in the batch or (for the first row) the latest stored row.
 *
 * Upsert-by-date means re-running the cron is safe. Existing rows get
 * their latest synced_at + latest values overwritten ONLY for numeric
 * weather fields (no user data ever lives in this table).
 */
export async function upsertWeatherRecords(
  records: WeatherDailyRecord[],
  options: UpsertOptions = {}
): Promise<UpsertResult> {
  if (records.length === 0) return { inserted: 0, rows: [] }

  const client = options.client ?? defaultClient
  const patientId = options.patientId ?? DEFAULT_PATIENT
  const latitude = options.latitude ?? DEFAULT_LAT
  const longitude = options.longitude ?? DEFAULT_LON

  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))
  const firstDate = sorted[0].date

  // Seed prior pressure from the most recent stored row strictly before
  // the first incoming date. Lets us compute pressure_change_24h even
  // when the batch is size 1.
  let priorPressure: number | null = null
  try {
    priorPressure = await getPriorPressure(firstDate, { patientId, client })
  } catch {
    priorPressure = null
  }

  const rows = sorted.map((rec) => {
    const change = computePressureChange24h(
      rec.pressure_mean_hpa,
      priorPressure
    )
    priorPressure = rec.pressure_mean_hpa ?? priorPressure
    return {
      date: rec.date,
      patient_id: patientId,
      location_lat: latitude,
      location_lon: longitude,
      temp_high_c: rec.temp_high_c,
      temp_low_c: rec.temp_low_c,
      humidity_mean: rec.humidity_mean,
      pressure_mean_hpa: rec.pressure_mean_hpa,
      pressure_change_24h: change,
      wind_mean_kmh: rec.wind_mean_kmh,
      precipitation_mm: rec.precipitation_mm,
      raw_json: rec.raw_json,
      synced_at: new Date().toISOString(),
    }
  })

  const { data, error } = await client
    .from('weather_daily')
    .upsert(rows, { onConflict: 'date' })
    .select(
      'date, patient_id, location_lat, location_lon, temp_high_c, temp_low_c, humidity_mean, pressure_mean_hpa, pressure_change_24h, wind_mean_kmh, precipitation_mm, raw_json, synced_at'
    )

  if (error) throw new Error(`weather_daily upsert failed: ${error.message}`)
  const returned = (data ?? []) as WeatherDailyRow[]
  return { inserted: returned.length, rows: returned }
}
