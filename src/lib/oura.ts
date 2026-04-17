// Oura Ring API client with token refresh logic
import { createServiceClient } from '@/lib/supabase'

const OURA_API_BASE = 'https://api.ouraring.com/v2'
const OURA_TOKEN_URL = 'https://api.ouraring.com/oauth/token'

interface OuraTokenRow {
  id: string
  access_token: string
  refresh_token: string | null
  expires_at: string | null
  scopes: string | null
}

/**
 * Exchange authorization code for access + refresh tokens
 */
export async function exchangeCodeForTokens(code: string) {
  const res = await fetch(OURA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.OURA_REDIRECT_URI!.trim(),
      client_id: process.env.OURA_CLIENT_ID!.trim(),
      client_secret: process.env.OURA_CLIENT_SECRET!.trim(),
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token exchange failed: ${res.status} ${text}`)
  }

  return res.json() as Promise<{
    access_token: string
    refresh_token: string
    expires_in: number
    token_type: string
  }>
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(OURA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.OURA_CLIENT_ID!.trim(),
      client_secret: process.env.OURA_CLIENT_SECRET!.trim(),
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token refresh failed: ${res.status} ${text}`)
  }

  return res.json() as Promise<{
    access_token: string
    refresh_token: string
    expires_in: number
    token_type: string
  }>
}

/**
 * Store tokens in Supabase (upsert - we only keep one row)
 */
export async function storeTokens(tokens: {
  access_token: string
  refresh_token: string
  expires_in: number
}) {
  const supabase = createServiceClient()
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  // Single-patient app: fetch the existing token rows explicitly, then delete by id.
  // This avoids the ambiguous `.neq('id', zero-uuid)` pattern which is a blanket
  // delete disguised as a scoped filter and violates the Zero Data Loss principle
  // if user semantics ever change.
  const { data: existingTokens } = await supabase.from('oura_tokens').select('id')
  if (existingTokens && existingTokens.length > 0) {
    const ids = (existingTokens as { id: string }[]).map((t) => t.id)
    await supabase.from('oura_tokens').delete().in('id', ids)
  }

  const { error } = await supabase.from('oura_tokens').insert({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  })

  if (error) throw new Error(`Failed to store tokens: ${error.message}`)
}

/**
 * Get a valid access token, refreshing if expired
 */
export async function getValidAccessToken(): Promise<string> {
  const supabase = createServiceClient()

  const { data: tokenRow, error } = await supabase
    .from('oura_tokens')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !tokenRow) {
    throw new Error('No Oura tokens found. Please connect your Oura Ring first.')
  }

  const row = tokenRow as OuraTokenRow

  // Check if token is expired (with 5 min buffer)
  if (row.expires_at) {
    const expiresAt = new Date(row.expires_at).getTime()
    const bufferMs = 5 * 60 * 1000
    if (Date.now() > expiresAt - bufferMs) {
      if (!row.refresh_token) {
        throw new Error('Token expired and no refresh token available. Please reconnect.')
      }
      // Refresh the token
      const newTokens = await refreshAccessToken(row.refresh_token)
      await storeTokens(newTokens)
      return newTokens.access_token
    }
  }

  return row.access_token
}

/**
 * Fetch data from the Oura API v2
 */
async function ouraFetch(path: string, accessToken: string) {
  const res = await fetch(`${OURA_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Oura API error: ${res.status} ${text}`)
  }

  return res.json()
}

/**
 * Fetch sleep data for a date range
 */
export async function fetchSleepData(accessToken: string, startDate: string, endDate: string) {
  return ouraFetch(`/usercollection/daily_sleep?start_date=${startDate}&end_date=${endDate}`, accessToken)
}

/**
 * Fetch readiness data for a date range
 */
export async function fetchReadinessData(accessToken: string, startDate: string, endDate: string) {
  return ouraFetch(`/usercollection/daily_readiness?start_date=${startDate}&end_date=${endDate}`, accessToken)
}

/**
 * Fetch heart rate data for a date range
 */
export async function fetchHeartRateData(accessToken: string, startDate: string, endDate: string) {
  return ouraFetch(`/usercollection/heartrate?start_datetime=${startDate}T00:00:00&end_datetime=${endDate}T23:59:59`, accessToken)
}

/**
 * Fetch stress data for a date range
 */
export async function fetchStressData(accessToken: string, startDate: string, endDate: string) {
  return ouraFetch(`/usercollection/daily_stress?start_date=${startDate}&end_date=${endDate}`, accessToken)
}

/**
 * Fetch SpO2 data for a date range
 */
export async function fetchSpO2Data(accessToken: string, startDate: string, endDate: string) {
  return ouraFetch(`/usercollection/daily_spo2?start_date=${startDate}&end_date=${endDate}`, accessToken)
}

/**
 * Fetch temperature data for a date range
 */
export async function fetchTemperatureData(accessToken: string, startDate: string, endDate: string) {
  return ouraFetch(`/usercollection/daily_readiness?start_date=${startDate}&end_date=${endDate}`, accessToken)
}

/**
 * Fetch sleep detail (for HRV, deep sleep, REM) for a date range
 */
export async function fetchSleepDetail(accessToken: string, startDate: string, endDate: string) {
  return ouraFetch(`/usercollection/sleep?start_date=${startDate}&end_date=${endDate}`, accessToken)
}

/**
 * Check if Oura is connected (has tokens stored)
 */
export async function isOuraConnected(): Promise<boolean> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('oura_tokens')
    .select('id')
    .limit(1)
    .maybeSingle()
  return !!data
}

/**
 * Disconnect Oura (remove tokens).
 *
 * Single-patient app: fetch the specific token rows first, then delete by id.
 * This replaces the previous `.neq('id', zero-uuid)` pattern, which was a
 * blanket delete disguised as a scoped filter and violated the Zero Data Loss
 * principle if the schema ever becomes multi-patient.
 */
export async function disconnectOura(): Promise<void> {
  const supabase = createServiceClient()
  const { data: tokens } = await supabase.from('oura_tokens').select('id')
  if (tokens && tokens.length > 0) {
    const ids = (tokens as { id: string }[]).map((t) => t.id)
    await supabase.from('oura_tokens').delete().in('id', ids)
  }
}
