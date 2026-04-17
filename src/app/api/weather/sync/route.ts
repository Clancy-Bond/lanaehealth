/**
 * POST /api/weather/sync  - Cron target for daily weather ingestion.
 * GET  /api/weather/sync  - Same behavior, for convenience / cron services
 *                           that only fire GET.
 *
 * Pulls the last 14 days of daily weather from Open-Meteo for Kailua HI
 * (default coords 21.392, -157.739) and upserts the rows into weather_daily
 * by date. Returns the first three rows of the response so the caller can
 * eyeball the data.
 *
 * No auth, no API key required for Open-Meteo. Upsert by date means
 * re-runs are idempotent.
 *
 * Ref: docs/plans/2026-04-16-wave-2a-briefs.md (A3)
 */

import { createServiceClient } from '@/lib/supabase'
import { fetchDailyWeather } from '@/lib/weather'
import { upsertWeatherRecords } from '@/lib/api/weather-daily'

// Kailua, HI (Lanae's location, from CLAUDE.md)
const DEFAULT_LATITUDE = 21.392
const DEFAULT_LONGITUDE = -157.739
const DEFAULT_PAST_DAYS = 14
const DEFAULT_TIMEZONE = 'Pacific/Honolulu'

interface SyncOptions {
  latitude?: number
  longitude?: number
  pastDays?: number
  timezone?: string
  patientId?: string
}

async function runSync(options: SyncOptions = {}) {
  const latitude = options.latitude ?? DEFAULT_LATITUDE
  const longitude = options.longitude ?? DEFAULT_LONGITUDE
  const pastDays = options.pastDays ?? DEFAULT_PAST_DAYS
  const timezone = options.timezone ?? DEFAULT_TIMEZONE
  const patientId = options.patientId ?? 'lanae'

  const records = await fetchDailyWeather({
    latitude,
    longitude,
    pastDays,
    timezone,
  })

  if (records.length === 0) {
    return {
      success: true,
      fetched: 0,
      inserted: 0,
      sample: [],
      message: 'Open-Meteo returned no daily rows',
    }
  }

  const supabase = createServiceClient()
  const { inserted, rows } = await upsertWeatherRecords(records, {
    client: supabase,
    patientId,
    latitude,
    longitude,
  })

  return {
    success: true,
    fetched: records.length,
    inserted,
    date_range: {
      start: records[0].date,
      end: records[records.length - 1].date,
    },
    sample: rows.slice(0, 3),
  }
}

function parsePayload(body: unknown): SyncOptions {
  if (!body || typeof body !== 'object') return {}
  const b = body as Record<string, unknown>
  const pastDaysRaw = b.past_days ?? b.pastDays
  const parsed: SyncOptions = {}
  if (typeof b.latitude === 'number') parsed.latitude = b.latitude
  if (typeof b.longitude === 'number') parsed.longitude = b.longitude
  if (typeof pastDaysRaw === 'number' && pastDaysRaw > 0 && pastDaysRaw <= 92) {
    parsed.pastDays = Math.floor(pastDaysRaw)
  }
  if (typeof b.timezone === 'string') parsed.timezone = b.timezone
  if (typeof b.patient_id === 'string') parsed.patientId = b.patient_id
  return parsed
}

export async function POST(request: Request) {
  try {
    let options: SyncOptions = {}
    try {
      const body = await request.json()
      options = parsePayload(body)
    } catch {
      // No body or invalid JSON is fine - fall through to defaults.
    }
    const result = await runSync(options)
    return Response.json(result)
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const result = await runSync()
    return Response.json(result)
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
