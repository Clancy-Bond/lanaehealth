/**
 * Garmin Connect Connector
 *
 * Integration with Garmin Health API for fitness and health data.
 * Uses OAuth 1.0a (Garmin's API requires it, not OAuth 2.0).
 *
 * Data: HR, steps, sleep, stress, SpO2, body comp, activities.
 * Garmin uses a push/ping model -- they send data to our webhook.
 * This connector handles the initial OAuth and data retrieval.
 *
 * Garmin API docs: https://developer.garmin.com/gc-developer-program/
 *
 * NOTE: Full Garmin integration requires a formal partnership application.
 * This connector implements the OAuth flow and data retrieval patterns.
 * The push/pull architecture can be added once partnership is approved.
 */

import { createServiceClient } from '@/lib/supabase'
import type { Connector, IntegrationConfig, IntegrationToken, SyncResult } from '../types'

const BASE_URL = 'https://apis.garmin.com'
const REQUEST_TOKEN_URL = 'https://connectapi.garmin.com/oauth-service/oauth/request_token'
const AUTH_URL = 'https://connect.garmin.com/oauthConfirm'
const ACCESS_TOKEN_URL = 'https://connectapi.garmin.com/oauth-service/oauth/access_token'

const config: IntegrationConfig = {
  id: 'garmin',
  name: 'Garmin Connect',
  description: 'Health and fitness data from Garmin devices',
  icon: '\u{231A}',
  category: 'wearable',
  authType: 'oauth2', // Technically OAuth 1.0a but we abstract it
  oauth: {
    authorizeUrl: AUTH_URL,
    tokenUrl: ACCESS_TOKEN_URL,
    clientIdEnvVar: 'GARMIN_CONSUMER_KEY',
    clientSecretEnvVar: 'GARMIN_CONSUMER_SECRET',
    scopes: [],
    responseType: 'code',
    grantType: 'authorization_code',
  },
  dataTypes: ['heart_rate', 'steps', 'sleep', 'stress', 'spo2', 'body_composition', 'activity', 'workout'],
  syncInterval: 180, // Every 3 hours
  website: 'https://connect.garmin.com',
}

// Garmin uses OAuth 1.0a which is more complex.
// For the MVP, we'll implement a simplified version that works with their
// Health API's pull endpoints. Full push integration requires webhook setup.

const garminConnector: Connector = {
  config,

  getAuthUrl(redirectUri: string, state: string): string {
    // Garmin OAuth 1.0a requires a request token first.
    // In practice, the API route handles the multi-step flow.
    const consumerKey = process.env[config.oauth!.clientIdEnvVar] ?? ''
    const params = new URLSearchParams({
      oauth_token: state, // Placeholder -- real flow gets request token first
      oauth_callback: redirectUri,
    })
    return `${AUTH_URL}?${params.toString()}`
  },

  async exchangeCode(code: string, _redirectUri: string): Promise<IntegrationToken> {
    // Garmin OAuth 1.0a token exchange
    // The verifier (code) is exchanged for an access token
    const consumerKey = process.env[config.oauth!.clientIdEnvVar] ?? ''
    const consumerSecret = process.env[config.oauth!.clientSecretEnvVar] ?? ''

    const res = await fetch(ACCESS_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `OAuth oauth_consumer_key="${consumerKey}", oauth_verifier="${code}"`,
      },
    })

    if (!res.ok) throw new Error(`Garmin token exchange failed: ${await res.text()}`)
    const text = await res.text()
    const params = new URLSearchParams(text)
    const now = new Date()

    return {
      id: crypto.randomUUID(),
      integration_id: 'garmin',
      access_token: params.get('oauth_token') ?? '',
      refresh_token: params.get('oauth_token_secret') ?? null,
      // Garmin tokens don't expire in the traditional sense
      expires_at: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      scopes: [],
      metadata: {
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
      },
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    }
  },

  async refreshToken(token: IntegrationToken): Promise<IntegrationToken> {
    // Garmin OAuth 1.0a tokens don't expire/refresh
    return token
  },

  async sync(token: IntegrationToken, startDate: string, endDate: string): Promise<SyncResult> {
    const syncStart = new Date()
    const errors: string[] = []
    let totalRecords = 0
    const sb = createServiceClient()

    // Convert dates to epoch seconds for Garmin API
    const startEpoch = Math.floor(new Date(startDate).getTime() / 1000)
    const endEpoch = Math.floor(new Date(endDate + 'T23:59:59').getTime() / 1000)

    const headers = {
      Authorization: `Bearer ${token.access_token}`,
    }

    try {
      // Fetch daily summaries (steps, calories, HR, stress)
      const dailyRes = await fetch(
        `${BASE_URL}/wellness-api/rest/dailies?uploadStartTimeInSeconds=${startEpoch}&uploadEndTimeInSeconds=${endEpoch}`,
        { headers },
      )

      if (dailyRes.ok) {
        const dailies = await dailyRes.json()

        for (const day of (Array.isArray(dailies) ? dailies : [])) {
          const date = new Date(day.calendarDate ?? day.startTimeInSeconds * 1000)
            .toISOString().slice(0, 10)

          await sb.from('oura_daily').upsert({
            date,
            hr_avg: day.restingHeartRateInBeatsPerMinute ?? null,
            steps: day.steps ?? null,
            cal_active: day.activeKilocalories ?? null,
            cal_total: day.totalKilocalories ?? null,
            stress_avg: day.averageStressLevel ?? null,
            spo2_avg: day.averageSPO2Value ?? null,
            source: 'garmin',
          }, { onConflict: 'date' })

          totalRecords++
        }
      }

      // Fetch sleep data
      const sleepRes = await fetch(
        `${BASE_URL}/wellness-api/rest/sleeps?uploadStartTimeInSeconds=${startEpoch}&uploadEndTimeInSeconds=${endEpoch}`,
        { headers },
      )

      if (sleepRes.ok) {
        const sleeps = await sleepRes.json()

        for (const sleep of (Array.isArray(sleeps) ? sleeps : [])) {
          const date = new Date(sleep.calendarDate ?? sleep.startTimeInSeconds * 1000)
            .toISOString().slice(0, 10)

          await sb.from('oura_daily').upsert({
            date,
            sleep_total: sleep.durationInSeconds ? Math.round(sleep.durationInSeconds / 60) : null,
            sleep_deep: sleep.deepSleepDurationInSeconds ? Math.round(sleep.deepSleepDurationInSeconds / 60) : null,
            sleep_rem: sleep.remSleepInSeconds ? Math.round(sleep.remSleepInSeconds / 60) : null,
            sleep_light: sleep.lightSleepDurationInSeconds ? Math.round(sleep.lightSleepDurationInSeconds / 60) : null,
            source: 'garmin',
          }, { onConflict: 'date' })

          totalRecords++
        }
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'Garmin sync error')
    }

    return {
      integrationId: 'garmin',
      success: errors.length === 0,
      recordsSync: totalRecords,
      dateRange: { start: startDate, end: endDate },
      dataTypes: ['heart_rate', 'steps', 'sleep', 'stress', 'spo2'],
      errors,
      duration: Date.now() - syncStart.getTime(),
      syncedAt: new Date().toISOString(),
    }
  },

  async disconnect(): Promise<void> {
    // Garmin deregistration handled via Garmin developer portal
  },
}

export default garminConnector
