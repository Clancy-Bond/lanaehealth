/**
 * Dexcom CGM Connector
 *
 * OAuth 2.0 integration with Dexcom API for continuous glucose monitoring.
 * Pulls: glucose readings (every 5 min), EGV data, calibration events.
 *
 * Dexcom API docs: https://developer.dexcom.com/docs/
 * Uses Sandbox for development, Production for live data.
 */

import { createServiceClient } from '@/lib/supabase'
import type { Connector, IntegrationConfig, IntegrationToken, SyncResult } from '../types'

const IS_SANDBOX = process.env.DEXCOM_SANDBOX === 'true'
const BASE_URL = IS_SANDBOX
  ? 'https://sandbox-api.dexcom.com'
  : 'https://api.dexcom.com'
const AUTH_URL = IS_SANDBOX
  ? 'https://sandbox-api.dexcom.com/v2/oauth2/login'
  : 'https://api.dexcom.com/v2/oauth2/login'
const TOKEN_URL = IS_SANDBOX
  ? 'https://sandbox-api.dexcom.com/v2/oauth2/token'
  : 'https://api.dexcom.com/v2/oauth2/token'

const config: IntegrationConfig = {
  id: 'dexcom',
  name: 'Dexcom CGM',
  description: 'Continuous glucose monitoring data from Dexcom G6/G7',
  icon: '\u{1FA78}',
  category: 'cgm',
  authType: 'oauth2',
  oauth: {
    authorizeUrl: AUTH_URL,
    tokenUrl: TOKEN_URL,
    clientIdEnvVar: 'DEXCOM_CLIENT_ID',
    clientSecretEnvVar: 'DEXCOM_CLIENT_SECRET',
    scopes: ['offline_access'],
    responseType: 'code',
    grantType: 'authorization_code',
  },
  dataTypes: ['blood_glucose'],
  syncInterval: 60, // Every hour
  website: 'https://www.dexcom.com',
}

interface DexcomEGV {
  systemTime: string
  displayTime: string
  value: number
  realtimeValue: number
  smoothedValue: number | null
  status: string | null
  trend: string
  trendRate: number | null
}

const dexcomConnector: Connector = {
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
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Dexcom token exchange failed: ${err}`)
    }

    const data = await res.json()
    const now = new Date()

    return {
      id: crypto.randomUUID(),
      integration_id: 'dexcom',
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? null,
      expires_at: new Date(now.getTime() + (data.expires_in ?? 7200) * 1000).toISOString(),
      scopes: config.oauth!.scopes,
      metadata: {},
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    }
  },

  async refreshToken(token: IntegrationToken): Promise<IntegrationToken> {
    if (!token.refresh_token) throw new Error('No refresh token available')

    const clientId = process.env[config.oauth!.clientIdEnvVar] ?? ''
    const clientSecret = process.env[config.oauth!.clientSecretEnvVar] ?? ''

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: token.refresh_token,
        grant_type: 'refresh_token',
      }),
    })

    if (!res.ok) throw new Error('Dexcom token refresh failed')
    const data = await res.json()
    const now = new Date()

    return {
      ...token,
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? token.refresh_token,
      expires_at: new Date(now.getTime() + (data.expires_in ?? 7200) * 1000).toISOString(),
      updated_at: now.toISOString(),
    }
  },

  async sync(token: IntegrationToken, startDate: string, endDate: string): Promise<SyncResult> {
    const syncStart = new Date()
    const errors: string[] = []
    let totalRecords = 0

    try {
      // Fetch EGV (Estimated Glucose Values) data
      const egvRes = await fetch(
        `${BASE_URL}/v3/users/self/egvs?startDate=${startDate}T00:00:00&endDate=${endDate}T23:59:59`,
        {
          headers: { Authorization: `Bearer ${token.access_token}` },
        },
      )

      if (!egvRes.ok) {
        const errText = await egvRes.text()
        throw new Error(`Dexcom EGV fetch failed (${egvRes.status}): ${errText}`)
      }

      const egvData = await egvRes.json()
      const readings: DexcomEGV[] = egvData.egvs ?? egvData.records ?? []

      if (readings.length === 0) {
        return {
          integrationId: 'dexcom',
          success: true,
          recordsSync: 0,
          dateRange: { start: startDate, end: endDate },
          dataTypes: ['blood_glucose'],
          errors: [],
          duration: Date.now() - syncStart.getTime(),
          syncedAt: new Date().toISOString(),
        }
      }

      // Aggregate readings by day for storage
      const dailyReadings = new Map<string, {
        values: number[]
        min: number
        max: number
        readings: Array<{ time: string; value: number; trend: string }>
      }>()

      for (const reading of readings) {
        const date = reading.displayTime.slice(0, 10)
        const value = reading.value ?? reading.realtimeValue

        if (!dailyReadings.has(date)) {
          dailyReadings.set(date, { values: [], min: Infinity, max: -Infinity, readings: [] })
        }

        const day = dailyReadings.get(date)!
        day.values.push(value)
        if (value < day.min) day.min = value
        if (value > day.max) day.max = value
        day.readings.push({
          time: reading.displayTime,
          value,
          trend: reading.trend,
        })
      }

      // Store daily aggregates in lab_results
      const sb = createServiceClient()

      for (const [date, day] of dailyReadings) {
        const avg = day.values.reduce((a, b) => a + b, 0) / day.values.length
        const timeInRange = day.values.filter(v => v >= 70 && v <= 180).length / day.values.length * 100

        // Store average glucose as a lab result
        await sb.from('lab_results').upsert({
          date,
          test_name: 'Glucose (CGM Average)',
          value: Math.round(avg),
          unit: 'mg/dL',
          category: 'CGM',
          flag: avg > 180 ? 'high' : avg < 70 ? 'low' : 'normal',
          reference_range_low: 70,
          reference_range_high: 180,
          source_document_id: `dexcom_${date}`,
        }, { onConflict: 'date,test_name' })

        // Store time in range
        await sb.from('lab_results').upsert({
          date,
          test_name: 'Time in Range (CGM)',
          value: Math.round(timeInRange),
          unit: '%',
          category: 'CGM',
          flag: timeInRange >= 70 ? 'normal' : timeInRange >= 50 ? 'low' : 'critical',
          reference_range_low: 70,
          reference_range_high: 100,
          source_document_id: `dexcom_${date}`,
        }, { onConflict: 'date,test_name' })

        // Store min/max
        await sb.from('lab_results').upsert({
          date,
          test_name: 'Glucose (CGM Min)',
          value: day.min,
          unit: 'mg/dL',
          category: 'CGM',
          flag: day.min < 54 ? 'critical' : day.min < 70 ? 'low' : 'normal',
          source_document_id: `dexcom_${date}`,
        }, { onConflict: 'date,test_name' })

        await sb.from('lab_results').upsert({
          date,
          test_name: 'Glucose (CGM Max)',
          value: day.max,
          unit: 'mg/dL',
          category: 'CGM',
          flag: day.max > 250 ? 'critical' : day.max > 180 ? 'high' : 'normal',
          source_document_id: `dexcom_${date}`,
        }, { onConflict: 'date,test_name' })

        totalRecords += 4 // 4 metrics per day
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'Unknown sync error')
    }

    return {
      integrationId: 'dexcom',
      success: errors.length === 0,
      recordsSync: totalRecords,
      dateRange: { start: startDate, end: endDate },
      dataTypes: ['blood_glucose'],
      errors,
      duration: Date.now() - syncStart.getTime(),
      syncedAt: new Date().toISOString(),
    }
  },

  async disconnect(token: IntegrationToken): Promise<void> {
    // Dexcom doesn't have a revoke endpoint -- just delete our token
    void token
  },
}

export default dexcomConnector
