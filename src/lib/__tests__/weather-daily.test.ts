/**
 * Tests for the weather_daily pipeline (migration 015).
 *
 * Covers:
 *   - Open-Meteo URL contains all required daily variables + past_days
 *   - normalizeDailyRow computes pressure_mean as the midpoint of
 *     pressure_msl_max and pressure_msl_min, and preserves raw values
 *   - fetchDailyWeather parses a forecast JSON response into ordered
 *     WeatherDailyRecord rows
 *   - computePressureChange24h handles null sides and returns a delta
 *   - upsertWeatherRecords computes pressure_change_24h across the batch
 *     using the seed from getPriorPressure (first row) and the prior
 *     record in the batch (subsequent rows)
 */
import { describe, it, expect, vi } from 'vitest'

// Stub the real supabase client so module import does not crash on missing
// env vars. Every test injects its own fake client via UpsertOptions.client,
// so this stub should never actually be called.
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => {
      throw new Error('default supabase client should not be used in tests')
    },
  },
  createServiceClient: () => ({
    from: () => {
      throw new Error('default service client should not be used in tests')
    },
  }),
}))

import {
  buildOpenMeteoUrl,
  normalizeDailyRow,
  computePressureChange24h,
  fetchDailyWeather,
  OPEN_METEO_DAILY_VARIABLES,
} from '../weather'
import { upsertWeatherRecords } from '../api/weather-daily'

// Minimal in-memory fake Supabase client satisfying the shape weather-daily.ts uses.
// Only the methods we actually call are implemented.
function makeFakeClient(opts: {
  priorPressure?: number | null
  upsertCapture?: unknown[]
} = {}) {
  const { priorPressure = null, upsertCapture = [] } = opts

  const priorBuilder = {
    select: () => priorBuilder,
    eq: () => priorBuilder,
    lt: () => priorBuilder,
    not: () => priorBuilder,
    order: () => priorBuilder,
    limit: async () => ({
      data:
        priorPressure === null
          ? []
          : [{ pressure_mean_hpa: priorPressure }],
      error: null,
    }),
  }

  const upsertBuilder = (rows: unknown[]) => {
    upsertCapture.push(rows)
    return {
      select: async () => ({ data: rows, error: null }),
    }
  }

  return {
    from(table: string) {
      if (table !== 'weather_daily') {
        throw new Error(`unexpected table ${table}`)
      }
      return {
        select: priorBuilder.select,
        eq: priorBuilder.eq,
        lt: priorBuilder.lt,
        not: priorBuilder.not,
        order: priorBuilder.order,
        limit: priorBuilder.limit,
        upsert: (rows: unknown[]) => upsertBuilder(rows),
      }
    },
  }
}

describe('buildOpenMeteoUrl', () => {
  it('includes all required daily variables', () => {
    const url = buildOpenMeteoUrl({
      latitude: 21.392,
      longitude: -157.739,
    })
    for (const variable of OPEN_METEO_DAILY_VARIABLES) {
      expect(url).toContain(variable)
    }
  })

  it('defaults to past_days=14 and Pacific/Honolulu timezone', () => {
    const url = buildOpenMeteoUrl({
      latitude: 21.392,
      longitude: -157.739,
    })
    expect(url).toContain('past_days=14')
    // encoded / character is %2F
    expect(url).toMatch(/timezone=Pacific(%2F|\/)Honolulu/)
  })

  it('allows overriding past_days and timezone', () => {
    const url = buildOpenMeteoUrl({
      latitude: 40,
      longitude: -74,
      pastDays: 7,
      timezone: 'America/New_York',
    })
    expect(url).toContain('past_days=7')
    expect(url).toMatch(/timezone=America(%2F|\/)New_York/)
  })
})

describe('normalizeDailyRow', () => {
  it('averages pressure_msl_max and pressure_msl_min', () => {
    const row = normalizeDailyRow(
      {
        time: ['2026-04-10'],
        temperature_2m_max: [27.4],
        temperature_2m_min: [21.1],
        pressure_msl_max: [1018.2],
        pressure_msl_min: [1015.8],
        relative_humidity_2m_mean: [72],
        wind_speed_10m_max: [18.4],
        precipitation_sum: [0.2],
      },
      0
    )
    expect(row).not.toBeNull()
    expect(row!.date).toBe('2026-04-10')
    expect(row!.temp_high_c).toBe(27.4)
    expect(row!.temp_low_c).toBe(21.1)
    // (1018.2 + 1015.8) / 2 = 1017
    expect(row!.pressure_mean_hpa).toBeCloseTo(1017, 6)
    expect(row!.humidity_mean).toBe(72)
    expect(row!.wind_mean_kmh).toBe(18.4)
    expect(row!.precipitation_mm).toBe(0.2)
    expect(row!.raw_json).toMatchObject({
      pressure_msl_max: 1018.2,
      pressure_msl_min: 1015.8,
    })
  })

  it('falls back to the single non-null pressure side when the other is null', () => {
    const row = normalizeDailyRow(
      {
        time: ['2026-04-11'],
        pressure_msl_max: [1020.0],
        pressure_msl_min: [null],
      },
      0
    )
    expect(row!.pressure_mean_hpa).toBe(1020.0)
  })

  it('returns null when the date is missing', () => {
    const row = normalizeDailyRow({ time: [] }, 0)
    expect(row).toBeNull()
  })
})

describe('fetchDailyWeather', () => {
  it('parses a forecast response into ordered records', async () => {
    const fakeResponse = {
      daily: {
        time: ['2026-04-08', '2026-04-09', '2026-04-10'],
        temperature_2m_max: [26.0, 27.0, 28.0],
        temperature_2m_min: [20.0, 21.0, 22.0],
        pressure_msl_max: [1016, 1017, 1018],
        pressure_msl_min: [1014, 1015, 1016],
        relative_humidity_2m_mean: [70, 71, 72],
        wind_speed_10m_max: [16, 17, 18],
        precipitation_sum: [0.0, 0.1, 0.2],
      },
    }
    const fakeFetch = async () =>
      new Response(JSON.stringify(fakeResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })

    const records = await fetchDailyWeather({
      latitude: 21.392,
      longitude: -157.739,
      fetchImpl: fakeFetch as typeof fetch,
    })

    expect(records).toHaveLength(3)
    expect(records.map((r) => r.date)).toEqual([
      '2026-04-08',
      '2026-04-09',
      '2026-04-10',
    ])
    expect(records[0].pressure_mean_hpa).toBe(1015)
    expect(records[2].temp_high_c).toBe(28.0)
  })

  it('throws when Open-Meteo returns an error status', async () => {
    const fakeFetch = async () =>
      new Response('upstream failure', { status: 502 })
    await expect(
      fetchDailyWeather({
        latitude: 21.392,
        longitude: -157.739,
        fetchImpl: fakeFetch as typeof fetch,
      })
    ).rejects.toThrow(/Open-Meteo/)
  })

  it('returns [] when the daily block is missing', async () => {
    const fakeFetch = async () =>
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    const records = await fetchDailyWeather({
      latitude: 21.392,
      longitude: -157.739,
      fetchImpl: fakeFetch as typeof fetch,
    })
    expect(records).toEqual([])
  })
})

describe('computePressureChange24h', () => {
  it('returns the delta when both sides are numbers', () => {
    expect(computePressureChange24h(1017, 1015)).toBe(2)
    expect(computePressureChange24h(1010, 1020)).toBe(-10)
  })

  it('returns null when either side is null', () => {
    expect(computePressureChange24h(null, 1015)).toBeNull()
    expect(computePressureChange24h(1017, null)).toBeNull()
    expect(computePressureChange24h(null, null)).toBeNull()
  })
})

describe('upsertWeatherRecords', () => {
  it('computes pressure_change_24h using stored prior + in-batch neighbors', async () => {
    const capture: unknown[] = []
    const client = makeFakeClient({
      priorPressure: 1014,
      upsertCapture: capture,
    })

    const records = [
      {
        date: '2026-04-08',
        temp_high_c: 26,
        temp_low_c: 20,
        humidity_mean: 70,
        pressure_mean_hpa: 1015, // 1015 - 1014 = +1
        wind_mean_kmh: 16,
        precipitation_mm: 0,
        raw_json: {},
      },
      {
        date: '2026-04-09',
        temp_high_c: 27,
        temp_low_c: 21,
        humidity_mean: 71,
        pressure_mean_hpa: 1016, // 1016 - 1015 = +1
        wind_mean_kmh: 17,
        precipitation_mm: 0,
        raw_json: {},
      },
      {
        date: '2026-04-10',
        temp_high_c: 28,
        temp_low_c: 22,
        humidity_mean: 72,
        pressure_mean_hpa: null, // null pressure -> null delta, prior stays 1016
        wind_mean_kmh: 18,
        precipitation_mm: 0,
        raw_json: {},
      },
    ]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await upsertWeatherRecords(records, { client: client as any })
    expect(result.inserted).toBe(3)

    const submitted = capture[0] as Array<Record<string, unknown>>
    expect(submitted).toHaveLength(3)
    expect(submitted[0].pressure_change_24h).toBe(1)
    expect(submitted[1].pressure_change_24h).toBe(1)
    expect(submitted[2].pressure_change_24h).toBeNull()

    for (const row of submitted) {
      expect(row.patient_id).toBe('lanae')
      expect(row.location_lat).toBe(21.392)
      expect(row.location_lon).toBe(-157.739)
      expect(typeof row.synced_at).toBe('string')
    }
  })

  it('returns { inserted: 0 } for an empty batch without touching the client', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client: any = {
      from: () => {
        throw new Error('should not be called on empty batch')
      },
    }
    const res = await upsertWeatherRecords([], { client })
    expect(res).toEqual({ inserted: 0, rows: [] })
  })
})
