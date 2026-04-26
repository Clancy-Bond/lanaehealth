/**
 * Weather API Route
 *
 * GET  /api/weather - Returns today's weather (fetches and caches in weather_daily)
 * POST /api/weather - Backfill historical weather data { start_date, end_date }
 *
 * Uses Kailua, HI coordinates (21.39, -157.74) as the patient's location.
 */

import { createServiceClient } from '@/lib/supabase'
import { fetchWeatherForDate, fetchWeatherRange } from '@/lib/weather'
import { requireCronAuth } from '@/lib/cron-auth'
import {
  recordCronStart,
  recordCronSuccess,
  recordCronFailure,
} from '@/lib/cron-runs'

export const dynamic = 'force-dynamic'
// Kailua, HI
const LATITUDE = 21.39
const LONGITUDE = -157.74

export async function GET(request: Request) {
  // Cron target. Fail-closed: requires `Authorization: Bearer $CRON_SECRET`.
  // The homepage widget reads `weather_daily` directly from Supabase; it
  // does not need to go through this route, so there is no public read path.
  const deny = requireCronAuth(request)
  if (deny) return deny
  const runHandle = await recordCronStart('api/weather')
  try {
    const supabase = createServiceClient()
    const today = new Date().toISOString().split('T')[0]

    // Check if we already have today's weather cached
    const { data: cached } = await supabase
      .from('weather_daily')
      .select('*')
      .eq('date', today)
      .single()

    if (cached) {
      await recordCronSuccess(runHandle, `cached=${today}`)
      return Response.json(cached)
    }

    // Fetch from Open-Meteo
    const weather = await fetchWeatherForDate(today, LATITUDE, LONGITUDE)

    if (!weather) {
      await recordCronFailure(runHandle, new Error('Failed to fetch weather data'))
      return Response.json(
        { error: 'Failed to fetch weather data' },
        { status: 502 }
      )
    }

    // Cache in Supabase
    const row = {
      date: weather.date,
      barometric_pressure_hpa: weather.barometric_pressure_hpa,
      temperature_c: weather.temperature_c,
      humidity_pct: weather.humidity_pct,
      weather_code: weather.weather_code?.toString() ?? null,
      description: weather.description,
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('weather_daily')
      .upsert(row, { onConflict: 'date' })
      .select()
      .single()

    if (insertErr) {
      // Return the fetched data even if caching fails
      console.error('Weather cache write failed:', insertErr.message)
      await recordCronSuccess(runHandle, `fetched=${today} cache_write_failed=${insertErr.message.slice(0, 80)}`)
      return Response.json(row)
    }

    await recordCronSuccess(runHandle, `fetched=${today}`)
    return Response.json(inserted)
  } catch (err) {
    await recordCronFailure(runHandle, err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const deny = requireCronAuth(request)
  if (deny) return deny
  try {
    const body = await request.json()
    const { start_date, end_date } = body as {
      start_date?: string
      end_date?: string
    }

    if (!start_date || !end_date) {
      return Response.json(
        { error: 'Missing required fields: start_date, end_date' },
        { status: 400 }
      )
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date) || !/^\d{4}-\d{2}-\d{2}$/.test(end_date)) {
      return Response.json(
        { error: 'Dates must be in YYYY-MM-DD format' },
        { status: 400 }
      )
    }

    if (start_date > end_date) {
      return Response.json(
        { error: 'start_date must be before end_date' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Check which dates we already have
    const { data: existing } = await supabase
      .from('weather_daily')
      .select('date')
      .gte('date', start_date)
      .lte('date', end_date)

    const existingDates = new Set((existing ?? []).map(r => r.date))

    // Fetch weather for the full range
    const weatherData = await fetchWeatherRange(start_date, end_date, LATITUDE, LONGITUDE)

    // Filter to only new dates
    const newRows = weatherData
      .filter(w => !existingDates.has(w.date))
      .map(w => ({
        date: w.date,
        barometric_pressure_hpa: w.barometric_pressure_hpa,
        temperature_c: w.temperature_c,
        humidity_pct: w.humidity_pct,
        weather_code: w.weather_code?.toString() ?? null,
        description: w.description,
      }))

    if (newRows.length === 0) {
      return Response.json({
        success: true,
        message: 'All dates already cached',
        inserted: 0,
        skipped: weatherData.length,
      })
    }

    // Insert in batches of 100
    let totalInserted = 0
    for (let i = 0; i < newRows.length; i += 100) {
      const batch = newRows.slice(i, i + 100)
      const { error } = await supabase
        .from('weather_daily')
        .upsert(batch, { onConflict: 'date' })

      if (error) {
        console.error(`Weather batch insert error at offset ${i}:`, error.message)
      } else {
        totalInserted += batch.length
      }
    }

    return Response.json({
      success: true,
      inserted: totalInserted,
      skipped: weatherData.length - newRows.length,
      dateRange: {
        start: start_date,
        end: end_date,
      },
    })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
