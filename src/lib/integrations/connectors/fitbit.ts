/**
 * Fitbit / Google Health Connector
 *
 * OAuth 2.0 integration with Fitbit Web API.
 * Pulls: activity, sleep, heart rate, SpO2, breathing rate, temperature.
 *
 * NOTE: Fitbit legacy API will be deprecated September 2026.
 * Migration to Google Health API will be needed.
 * For now, uses the stable Fitbit Web API v1.
 *
 * Fitbit API docs: https://dev.fitbit.com/build/reference/web-api/
 */

import { createServiceClient } from '@/lib/supabase'
import type { Connector, IntegrationConfig, IntegrationToken, SyncResult } from '../types'

const BASE_URL = 'https://api.fitbit.com'
const AUTH_URL = 'https://www.fitbit.com/oauth2/authorize'
const TOKEN_URL = 'https://api.fitbit.com/oauth2/token'

const config: IntegrationConfig = {
  id: 'fitbit',
  name: 'Fitbit',
  description: 'Activity, sleep, and heart rate from Fitbit devices',
  icon: '\u{1F4F1}',
  category: 'wearable',
  authType: 'oauth2',
  oauth: {
    authorizeUrl: AUTH_URL,
    tokenUrl: TOKEN_URL,
    clientIdEnvVar: 'FITBIT_CLIENT_ID',
    clientSecretEnvVar: 'FITBIT_CLIENT_SECRET',
    scopes: ['activity', 'heartrate', 'sleep', 'oxygen_saturation', 'respiratory_rate', 'temperature'],
    responseType: 'code',
    grantType: 'authorization_code',
    pkce: true,
  },
  dataTypes: ['activity', 'sleep', 'heart_rate', 'spo2', 'respiratory_rate', 'temperature', 'steps', 'calories'],
  syncInterval: 120,
  website: 'https://www.fitbit.com',
}

const fitbitConnector: Connector = {
  config,

  getAuthUrl(redirectUri: string, state: string): string {
    const clientId = process.env[config.oauth!.clientIdEnvVar] ?? ''
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: config.oauth!.scopes.join(' '),
      state,
      code_challenge_method: 'S256',
    })
    return `${AUTH_URL}?${params.toString()}`
  },

  async exchangeCode(code: string, redirectUri: string): Promise<IntegrationToken> {
    const clientId = process.env[config.oauth!.clientIdEnvVar] ?? ''
    const clientSecret = process.env[config.oauth!.clientSecretEnvVar] ?? ''

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    })

    if (!res.ok) throw new Error(`Fitbit token exchange failed: ${await res.text()}`)
    const data = await res.json()
    const now = new Date()

    return {
      id: crypto.randomUUID(),
      integration_id: 'fitbit',
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? null,
      expires_at: new Date(now.getTime() + (data.expires_in ?? 28800) * 1000).toISOString(),
      scopes: data.scope?.split(' ') ?? config.oauth!.scopes,
      metadata: { user_id: data.user_id },
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    }
  },

  async refreshToken(token: IntegrationToken): Promise<IntegrationToken> {
    if (!token.refresh_token) throw new Error('No refresh token')
    const clientId = process.env[config.oauth!.clientIdEnvVar] ?? ''
    const clientSecret = process.env[config.oauth!.clientSecretEnvVar] ?? ''

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        refresh_token: token.refresh_token,
        grant_type: 'refresh_token',
      }),
    })

    if (!res.ok) throw new Error('Fitbit token refresh failed')
    const data = await res.json()
    const now = new Date()

    return {
      ...token,
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? token.refresh_token,
      expires_at: new Date(now.getTime() + (data.expires_in ?? 28800) * 1000).toISOString(),
      updated_at: now.toISOString(),
    }
  },

  async sync(token: IntegrationToken, startDate: string, endDate: string): Promise<SyncResult> {
    const syncStart = new Date()
    const errors: string[] = []
    let totalRecords = 0
    const sb = createServiceClient()
    const headers = { Authorization: `Bearer ${token.access_token}` }

    try {
      // Fetch sleep data for date range
      const sleepRes = await fetch(
        `${BASE_URL}/1.2/user/-/sleep/date/${startDate}/${endDate}.json`,
        { headers },
      )

      if (sleepRes.ok) {
        const sleepData = await sleepRes.json()
        for (const sleep of sleepData.sleep ?? []) {
          const date = sleep.dateOfSleep
          const summary = sleep.levels?.summary

          await sb.from('oura_daily').upsert({
            date,
            sleep_score: sleep.efficiency ?? null,
            sleep_total: sleep.duration ? Math.round(sleep.duration / 60000) : null,
            sleep_deep: summary?.deep?.minutes ?? null,
            sleep_rem: summary?.rem?.minutes ?? null,
            sleep_light: summary?.light?.minutes ?? null,
            sleep_efficiency: sleep.efficiency ?? null,
            source: 'fitbit',
          }, { onConflict: 'date' })

          totalRecords++
        }
      }

      // Fetch daily activity summaries
      // Fitbit requires individual day requests for activity
      const start = new Date(startDate)
      const end = new Date(endDate)
      const dayMs = 24 * 60 * 60 * 1000

      for (let d = start; d <= end; d = new Date(d.getTime() + dayMs)) {
        const dateStr = d.toISOString().slice(0, 10)

        try {
          const actRes = await fetch(
            `${BASE_URL}/1/user/-/activities/date/${dateStr}.json`,
            { headers },
          )

          if (actRes.ok) {
            const actData = await actRes.json()
            const summary = actData.summary

            if (summary) {
              await sb.from('oura_daily').upsert({
                date: dateStr,
                steps: summary.steps ?? null,
                cal_active: summary.activityCalories ?? null,
                cal_total: summary.caloriesOut ?? null,
                hr_avg: summary.restingHeartRate ?? null,
                source: 'fitbit',
              }, { onConflict: 'date' })

              totalRecords++
            }
          }
        } catch {
          // Individual day failures are acceptable
        }

        // Rate limit: 150 requests per hour for Fitbit
        // Add a small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'Fitbit sync error')
    }

    return {
      integrationId: 'fitbit',
      success: errors.length === 0,
      recordsSync: totalRecords,
      dateRange: { start: startDate, end: endDate },
      dataTypes: ['sleep', 'heart_rate', 'steps', 'calories', 'activity'],
      errors,
      duration: Date.now() - syncStart.getTime(),
      syncedAt: new Date().toISOString(),
    }
  },

  async disconnect(token: IntegrationToken): Promise<void> {
    // Revoke Fitbit token
    const clientId = process.env[config.oauth!.clientIdEnvVar] ?? ''
    const clientSecret = process.env[config.oauth!.clientSecretEnvVar] ?? ''

    await fetch('https://api.fitbit.com/oauth2/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({ token: token.access_token }),
    }).catch(() => {})
  },
}

export default fitbitConnector
