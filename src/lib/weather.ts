/**
 * Weather Integration - Open-Meteo API
 *
 * Free weather data, no API key needed.
 * Fetches barometric pressure, temperature, humidity, and weather codes.
 */

export interface WeatherData {
  date: string
  barometric_pressure_hpa: number | null
  temperature_c: number | null
  humidity_pct: number | null
  weather_code: number | null
  description: string | null
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
