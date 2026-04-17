/**
 * Weather Integration - Open-Meteo API
 *
 * Free weather data, no API key needed.
 * Fetches barometric pressure, temperature, humidity, and weather codes.
 *
 * Exports two client shapes:
 *   - fetchWeatherForDate / fetchWeatherRange: legacy WeatherData shape
 *     (used by GET/POST /api/weather).
 *   - fetchDailyWeather: richer WeatherDailyRecord shape for the
 *     weather_daily pipeline (migration 015, /api/weather/sync). Returns
 *     temp_high/low, pressure_mean/min/max, humidity_mean, wind, precipitation,
 *     and raw_json. Built for barometric-pressure correlation with POTS.
 */

export interface WeatherData {
  date: string
  barometric_pressure_hpa: number | null
  temperature_c: number | null
  humidity_pct: number | null
  weather_code: number | null
  description: string | null
}

/**
 * Shape returned by fetchDailyWeather, matching the weather_daily table
 * after migration 015. One row per date. pressure_change_24h is computed
 * downstream (requires the previous day's row), so it is not populated here.
 */
export interface WeatherDailyRecord {
  date: string
  temp_high_c: number | null
  temp_low_c: number | null
  humidity_mean: number | null
  pressure_mean_hpa: number | null
  wind_mean_kmh: number | null
  precipitation_mm: number | null
  raw_json: Record<string, unknown>
}

// Weather code descriptions (WMO standard)
const WEATHER_CODES: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow fall',
  73: 'Moderate snow fall',
  75: 'Heavy snow fall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
}

function getWeatherDescription(code: number | null): string | null {
  if (code === null) return null
  return WEATHER_CODES[code] ?? `Unknown (${code})`
}

interface OpenMeteoResponse {
  daily?: {
    time?: string[]
    surface_pressure_mean?: (number | null)[]
    temperature_2m_mean?: (number | null)[]
    relative_humidity_2m_mean?: (number | null)[]
    weather_code?: (number | null)[]
  }
}

/**
 * Fetch weather data for a specific date.
 * Uses the forecast API for today/future, archive API for past dates.
 */
export async function fetchWeatherForDate(
  date: string,
  latitude: number,
  longitude: number
): Promise<WeatherData | null> {
  const results = await fetchWeatherRange(date, date, latitude, longitude)
  return results[0] ?? null
}

/**
 * Fetch weather data for a date range.
 * Automatically picks the correct Open-Meteo endpoint:
 *   - archive API for past dates
 *   - forecast API for today/future
 */
export async function fetchWeatherRange(
  startDate: string,
  endDate: string,
  lat: number,
  lon: number
): Promise<WeatherData[]> {
  const today = new Date().toISOString().split('T')[0]
  const results: WeatherData[] = []

  // Split into archive and forecast ranges if needed
  const archiveEnd = endDate <= today ? endDate : (startDate < today ? today : null)
  const forecastStart = startDate >= today ? startDate : (endDate >= today ? today : null)

  // Fetch from archive API for historical dates
  if (startDate < today && archiveEnd) {
    const archiveData = await fetchFromEndpoint(
      'https://archive-api.open-meteo.com/v1/archive',
      startDate,
      archiveEnd < today ? archiveEnd : new Date(Date.now() - 86400000).toISOString().split('T')[0],
      lat,
      lon
    )
    results.push(...archiveData)
  }

  // Fetch from forecast API for today/future
  if (forecastStart) {
    const forecastData = await fetchFromEndpoint(
      'https://api.open-meteo.com/v1/forecast',
      forecastStart,
      endDate,
      lat,
      lon
    )
    // Avoid duplicates for today if it was in both ranges
    const existingDates = new Set(results.map(r => r.date))
    for (const item of forecastData) {
      if (!existingDates.has(item.date)) {
        results.push(item)
      }
    }
  }

  return results.sort((a, b) => a.date.localeCompare(b.date))
}

async function fetchFromEndpoint(
  baseUrl: string,
  startDate: string,
  endDate: string,
  lat: number,
  lon: number
): Promise<WeatherData[]> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    start_date: startDate,
    end_date: endDate,
    daily: 'surface_pressure_mean,temperature_2m_mean,relative_humidity_2m_mean,weather_code',
    timezone: 'Pacific/Honolulu',
  })

  const url = `${baseUrl}?${params.toString()}`

  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 3600 }, // Cache for 1 hour
  })

  if (!res.ok) {
    console.error(`Open-Meteo API error: ${res.status} ${res.statusText}`)
    return []
  }

  const json: OpenMeteoResponse = await res.json()
  const daily = json.daily

  if (!daily?.time) return []

  const results: WeatherData[] = []
  for (let i = 0; i < daily.time.length; i++) {
    const code = daily.weather_code?.[i] ?? null
    results.push({
      date: daily.time[i],
      barometric_pressure_hpa: daily.surface_pressure_mean?.[i] ?? null,
      temperature_c: daily.temperature_2m_mean?.[i] ?? null,
      humidity_pct: daily.relative_humidity_2m_mean?.[i] ?? null,
      weather_code: code,
      description: getWeatherDescription(code),
    })
  }

  return results
}

// ─────────────────────────────────────────────────────────────────────
// Richer Open-Meteo client used by /api/weather/sync (cron target)
// ─────────────────────────────────────────────────────────────────────

interface OpenMeteoForecastResponse {
  daily?: {
    time?: string[]
    temperature_2m_max?: (number | null)[]
    temperature_2m_min?: (number | null)[]
    pressure_msl_max?: (number | null)[]
    pressure_msl_min?: (number | null)[]
    relative_humidity_2m_mean?: (number | null)[]
    wind_speed_10m_max?: (number | null)[]
    precipitation_sum?: (number | null)[]
  }
}

const OPEN_METEO_FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast'

export const OPEN_METEO_DAILY_VARIABLES = [
  'temperature_2m_max',
  'temperature_2m_min',
  'pressure_msl_max',
  'pressure_msl_min',
  'relative_humidity_2m_mean',
  'wind_speed_10m_max',
  'precipitation_sum',
] as const

/**
 * Build the Open-Meteo forecast URL used by fetchDailyWeather. Exposed for
 * test inspection; production code should call fetchDailyWeather directly.
 */
export function buildOpenMeteoUrl(options: {
  latitude: number
  longitude: number
  pastDays?: number
  timezone?: string
}): string {
  const params = new URLSearchParams({
    latitude: options.latitude.toString(),
    longitude: options.longitude.toString(),
    daily: OPEN_METEO_DAILY_VARIABLES.join(','),
    timezone: options.timezone ?? 'Pacific/Honolulu',
    past_days: (options.pastDays ?? 14).toString(),
  })
  return `${OPEN_METEO_FORECAST_ENDPOINT}?${params.toString()}`
}

/**
 * Normalize one index of an Open-Meteo daily block into a WeatherDailyRecord.
 * pressure_mean_hpa is the average of pressure_msl_max and pressure_msl_min.
 */
export function normalizeDailyRow(
  daily: NonNullable<OpenMeteoForecastResponse['daily']>,
  i: number
): WeatherDailyRecord | null {
  const date = daily.time?.[i]
  if (!date) return null

  const pMax = daily.pressure_msl_max?.[i] ?? null
  const pMin = daily.pressure_msl_min?.[i] ?? null
  let pressureMean: number | null = null
  if (pMax !== null && pMin !== null) {
    pressureMean = (pMax + pMin) / 2
  } else if (pMax !== null) {
    pressureMean = pMax
  } else if (pMin !== null) {
    pressureMean = pMin
  }

  return {
    date,
    temp_high_c: daily.temperature_2m_max?.[i] ?? null,
    temp_low_c: daily.temperature_2m_min?.[i] ?? null,
    humidity_mean: daily.relative_humidity_2m_mean?.[i] ?? null,
    pressure_mean_hpa: pressureMean,
    wind_mean_kmh: daily.wind_speed_10m_max?.[i] ?? null,
    precipitation_mm: daily.precipitation_sum?.[i] ?? null,
    raw_json: {
      temperature_2m_max: daily.temperature_2m_max?.[i] ?? null,
      temperature_2m_min: daily.temperature_2m_min?.[i] ?? null,
      pressure_msl_max: pMax,
      pressure_msl_min: pMin,
      relative_humidity_2m_mean: daily.relative_humidity_2m_mean?.[i] ?? null,
      wind_speed_10m_max: daily.wind_speed_10m_max?.[i] ?? null,
      precipitation_sum: daily.precipitation_sum?.[i] ?? null,
    },
  }
}

/**
 * Fetch the last `pastDays` days (default 14) of daily weather from Open-Meteo
 * for the given coordinates. Returns rows in chronological order.
 *
 * No auth, no API key. Free tier is more than enough for one patient/day.
 */
export async function fetchDailyWeather(options: {
  latitude: number
  longitude: number
  pastDays?: number
  timezone?: string
  fetchImpl?: typeof fetch
}): Promise<WeatherDailyRecord[]> {
  const url = buildOpenMeteoUrl(options)
  const fetchFn = options.fetchImpl ?? fetch
  const res = await fetchFn(url, {
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) {
    throw new Error(
      `Open-Meteo forecast error: ${res.status} ${res.statusText}`
    )
  }

  const json = (await res.json()) as OpenMeteoForecastResponse
  const daily = json.daily
  if (!daily?.time) return []

  const records: WeatherDailyRecord[] = []
  for (let i = 0; i < daily.time.length; i++) {
    const row = normalizeDailyRow(daily, i)
    if (row) records.push(row)
  }
  return records.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Compute 24h pressure change for a target record, given the prior day's
 * pressure_mean_hpa (if available). Returns null when either side is null.
 */
export function computePressureChange24h(
  currentPressure: number | null,
  priorPressure: number | null
): number | null {
  if (currentPressure === null || priorPressure === null) return null
  return currentPressure - priorPressure
}
