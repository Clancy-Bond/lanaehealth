/**
 * WHOOP Connector
 *
 * OAuth 2.0 integration with WHOOP API.
 * Pulls: recovery, strain, sleep, workouts, cycles.
 *
 * WHOOP API docs: https://developer.whoop.com/api/
 */

import { createServiceClient } from '@/lib/supabase'
import type { Connector, IntegrationConfig, IntegrationToken, SyncResult } from '../types'

const BASE_URL = 'https://api.prod.whoop.com/developer'
const AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth'
const TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token'

const config: IntegrationConfig = {
  id: 'whoop',
  name: 'WHOOP',
  description: 'Recovery, strain, sleep, and workout data from WHOOP',
  icon: '\u{1F4AA}',
  category: 'wearable',
  authType: 'oauth2',
  oauth: {
    authorizeUrl: AUTH_URL,
    tokenUrl: TOKEN_URL,
    clientIdEnvVar: 'WHOOP_CLIENT_ID',
    clientSecretEnvVar: 'WHOOP_CLIENT_SECRET',
    scopes: ['read:recovery', 'read:sleep', 'read:workout', 'read:cycles', 'read:body_measurement'],
    responseType: 'code',
    grantType: 'authorization_code',
  },
  dataTypes: ['sleep', 'heart_rate', 'hrv', 'recovery', 'workout', 'calories', 'body_composition'],
  syncInterval: 120, // Every 2 hours
  website: 'https://www.whoop.com',
}

const whoopConnector: Connector = {
  config,

  getAuthUrl(redirectUri: string, state: string): string {
    const clientId = process.env[config.oauth!.clientIdEnvVar] ?? ''
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: config.oauth!.scopes.join(' '),
      state,
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

    if (!res.ok) throw new Error(`WHOOP token exchange failed: ${await res.text()}`)
    const data = await res.json()
    const now = new Date()

    return {
      id: crypto.randomUUID(),
      integration_id: 'whoop',
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? null,
      expires_at: new Date(now.getTime() + (data.expires_in ?? 3600) * 1000).toISOString(),
      scopes: config.oauth!.scopes,
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

    if (!res.ok) throw new Error('WHOOP token refresh failed')
    const data = await res.json()
    const now = new Date()

    return {
      ...token,
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? token.refresh_token,
      expires_at: new Date(now.getTime() + (data.expires_in ?? 3600) * 1000).toISOString(),
      updated_at: now.toISOString(),
    }
  },

  async sync(token: IntegrationToken, startDate: string, endDate: string): Promise<SyncResult> {
    const syncStart = new Date()
    const errors: string[] = []
    let totalRecords = 0
    const sb = createServiceClient()

    const headers = { Authorization: `Bearer ${token.access_token}` }
    const params = `start=${startDate}T00:00:00.000Z&end=${endDate}T23:59:59.999Z`

    try {
      // Fetch recovery data
      const recoveryRes = await fetch(`${BASE_URL}/v1/recovery?${params}`, { headers })
      if (recoveryRes.ok) {
        const recoveryData = await recoveryRes.json()
        const records = recoveryData.records ?? []

        for (const rec of records) {
          const date = rec.created_at?.slice(0, 10) ?? rec.cycle?.days?.[0]
          if (!date) continue

          const score = rec.score
          if (!score) continue

          // Store recovery metrics in oura_daily (shared biometric table)
          await sb.from('oura_daily').upsert({
            date,
            // Map WHOOP recovery to comparable fields
            readiness_score: Math.round(score.recovery_score ?? 0),
            hr_lowest: score.resting_heart_rate ? Math.round(score.resting_heart_rate) : null,
            hrv_avg: score.hrv_rmssd_milli ? Math.round(score.hrv_rmssd_milli) : null,
            spo2_avg: score.spo2_percentage ? Math.round(score.spo2_percentage * 100) : null,
            source: 'whoop',
          }, { onConflict: 'date' })

          totalRecords++
        }
      }

      // Fetch sleep data
      const sleepRes = await fetch(`${BASE_URL}/v1/activity/sleep?${params}`, { headers })
      if (sleepRes.ok) {
        const sleepData = await sleepRes.json()
        const records = sleepData.records ?? []

        for (const rec of records) {
          const date = rec.created_at?.slice(0, 10)
          if (!date) continue

          const score = rec.score
          if (!score) continue

          // Update sleep fields
          await sb.from('oura_daily').upsert({
            date,
            sleep_score: score.stage_summary?.sleep_performance_percentage
              ? Math.round(score.stage_summary.sleep_performance_percentage)
              : null,
            sleep_total: score.stage_summary?.total_in_bed_time_milli
              ? Math.round(score.stage_summary.total_in_bed_time_milli / 60000)
              : null,
            sleep_deep: score.stage_summary?.total_slow_wave_sleep_time_milli
              ? Math.round(score.stage_summary.total_slow_wave_sleep_time_milli / 60000)
              : null,
            sleep_rem: score.stage_summary?.total_rem_sleep_time_milli
              ? Math.round(score.stage_summary.total_rem_sleep_time_milli / 60000)
              : null,
            sleep_light: score.stage_summary?.total_light_sleep_time_milli
              ? Math.round(score.stage_summary.total_light_sleep_time_milli / 60000)
              : null,
            sleep_efficiency: score.sleep_efficiency_percentage
              ? Math.round(score.sleep_efficiency_percentage * 100)
              : null,
            source: 'whoop',
          }, { onConflict: 'date' })

          totalRecords++
        }
      }

      // Fetch workout data
      const workoutRes = await fetch(`${BASE_URL}/v1/activity/workout?${params}`, { headers })
      if (workoutRes.ok) {
        const workoutData = await workoutRes.json()
        const records = workoutData.records ?? []

        for (const rec of records) {
          const date = rec.created_at?.slice(0, 10)
          if (!date) continue

          const score = rec.score
          // Store as activity in daily_logs or a workout table
          await sb.from('lab_results').upsert({
            date,
            test_name: `WHOOP Strain (${rec.sport_id ?? 'Activity'})`,
            value: score?.strain ? Math.round(score.strain * 10) / 10 : null,
            unit: 'strain',
            category: 'Activity',
            flag: 'normal',
            source_document_id: `whoop_workout_${date}`,
          }, { onConflict: 'date,test_name' })

          totalRecords++
        }
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'WHOOP sync error')
    }

    return {
      integrationId: 'whoop',
      success: errors.length === 0,
      recordsSync: totalRecords,
      dateRange: { start: startDate, end: endDate },
      dataTypes: ['sleep', 'heart_rate', 'hrv', 'recovery', 'workout'],
      errors,
      duration: Date.now() - syncStart.getTime(),
      syncedAt: new Date().toISOString(),
    }
  },

  async disconnect(): Promise<void> {
    // WHOOP doesn't have a revoke endpoint
  },
}

export default whoopConnector
