/**
 * Withings Connector
 *
 * OAuth 2.0 integration with Withings API.
 * Pulls: weight, body composition, blood pressure, sleep, temperature.
 *
 * Withings API docs: https://developer.withings.com/
 */

import { createServiceClient } from '@/lib/supabase'
import type { Connector, IntegrationConfig, IntegrationToken, SyncResult } from '../types'

const BASE_URL = 'https://wbsapi.withings.net'
const AUTH_URL = 'https://account.withings.com/oauth2_user/authorize2'
const TOKEN_URL = 'https://wbsapi.withings.net/v2/oauth2'

const config: IntegrationConfig = {
  id: 'withings',
  name: 'Withings',
  description: 'Weight, body composition, blood pressure, and sleep from Withings devices',
  icon: '\u{2696}',
  category: 'scale',
  authType: 'oauth2',
  oauth: {
    authorizeUrl: AUTH_URL,
    tokenUrl: TOKEN_URL,
    clientIdEnvVar: 'WITHINGS_CLIENT_ID',
    clientSecretEnvVar: 'WITHINGS_CLIENT_SECRET',
    scopes: ['user.metrics', 'user.activity'],
    responseType: 'code',
    grantType: 'authorization_code',
  },
  dataTypes: ['weight', 'body_composition', 'blood_pressure', 'sleep', 'temperature'],
  syncInterval: 240, // Every 4 hours
  website: 'https://www.withings.com',
}

// Withings measure types
const MEASURE_TYPES = {
  1: { name: 'weight', unit: 'kg' },
  4: { name: 'height', unit: 'm' },
  5: { name: 'body_fat', unit: '%' },
  6: { name: 'body_fat_mass', unit: 'kg' },
  8: { name: 'fat_free_mass', unit: 'kg' },
  9: { name: 'blood_pressure_diastolic', unit: 'mmHg' },
  10: { name: 'blood_pressure_systolic', unit: 'mmHg' },
  11: { name: 'heart_rate', unit: 'bpm' },
  12: { name: 'temperature', unit: 'C' },
  54: { name: 'spo2', unit: '%' },
  76: { name: 'muscle_mass', unit: 'kg' },
  77: { name: 'water_mass', unit: 'kg' },
  88: { name: 'bone_mass', unit: 'kg' },
  170: { name: 'visceral_fat', unit: 'rating' },
} as Record<number, { name: string; unit: string }>

const withingsConnector: Connector = {
  config,

  getAuthUrl(redirectUri: string, state: string): string {
    const clientId = process.env[config.oauth!.clientIdEnvVar] ?? ''
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: config.oauth!.scopes.join(','),
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
        action: 'requesttoken',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    })

    if (!res.ok) throw new Error(`Withings token exchange failed`)
    const json = await res.json()
    const data = json.body
    const now = new Date()

    return {
      id: crypto.randomUUID(),
      integration_id: 'withings',
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? null,
      expires_at: new Date(now.getTime() + (data.expires_in ?? 10800) * 1000).toISOString(),
      scopes: config.oauth!.scopes,
      metadata: { userid: data.userid },
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
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        action: 'requesttoken',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: token.refresh_token,
        grant_type: 'refresh_token',
      }),
    })

    if (!res.ok) throw new Error('Withings token refresh failed')
    const json = await res.json()
    const data = json.body
    const now = new Date()

    return {
      ...token,
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? token.refresh_token,
      expires_at: new Date(now.getTime() + (data.expires_in ?? 10800) * 1000).toISOString(),
      updated_at: now.toISOString(),
    }
  },

  async sync(token: IntegrationToken, startDate: string, endDate: string): Promise<SyncResult> {
    const syncStart = new Date()
    const errors: string[] = []
    let totalRecords = 0
    const sb = createServiceClient()

    const startEpoch = Math.floor(new Date(startDate).getTime() / 1000)
    const endEpoch = Math.floor(new Date(endDate + 'T23:59:59').getTime() / 1000)

    try {
      // Fetch body measurements (weight, body comp, BP)
      const measRes = await fetch(`${BASE_URL}/measure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${token.access_token}`,
        },
        body: new URLSearchParams({
          action: 'getmeas',
          startdate: startEpoch.toString(),
          enddate: endEpoch.toString(),
          meastypes: '1,5,6,8,9,10,11,76,77,88,170', // All relevant types
        }),
      })

      if (measRes.ok) {
        const json = await measRes.json()
        const measureGroups = json.body?.measuregrps ?? []

        // Group measurements by date
        const dailyMeasures = new Map<string, Record<string, number>>()

        for (const grp of measureGroups) {
          const date = new Date(grp.date * 1000).toISOString().slice(0, 10)
          if (!dailyMeasures.has(date)) dailyMeasures.set(date, {})
          const day = dailyMeasures.get(date)!

          for (const m of grp.measures ?? []) {
            const typeInfo = MEASURE_TYPES[m.type as number]
            if (!typeInfo) continue

            // Withings stores values with a power-of-10 multiplier
            const value = m.value * Math.pow(10, m.unit)
            day[typeInfo.name] = value
          }
        }

        // Store measurements
        for (const [date, measures] of dailyMeasures) {
          // Weight and body composition
          if (measures.weight) {
            await sb.from('lab_results').upsert({
              date,
              test_name: 'Weight',
              value: Math.round(measures.weight * 10) / 10,
              unit: 'kg',
              category: 'Body Composition',
              flag: 'normal',
              source_document_id: `withings_${date}`,
            }, { onConflict: 'date,test_name' })
            totalRecords++
          }

          if (measures.body_fat) {
            await sb.from('lab_results').upsert({
              date,
              test_name: 'Body Fat',
              value: Math.round(measures.body_fat * 10) / 10,
              unit: '%',
              category: 'Body Composition',
              flag: 'normal',
              source_document_id: `withings_${date}`,
            }, { onConflict: 'date,test_name' })
            totalRecords++
          }

          if (measures.muscle_mass) {
            await sb.from('lab_results').upsert({
              date,
              test_name: 'Muscle Mass',
              value: Math.round(measures.muscle_mass * 10) / 10,
              unit: 'kg',
              category: 'Body Composition',
              flag: 'normal',
              source_document_id: `withings_${date}`,
            }, { onConflict: 'date,test_name' })
            totalRecords++
          }

          // Blood pressure
          if (measures.blood_pressure_systolic && measures.blood_pressure_diastolic) {
            const sys = Math.round(measures.blood_pressure_systolic)
            const dia = Math.round(measures.blood_pressure_diastolic)
            let flag: string = 'normal'
            if (sys >= 180 || dia >= 120) flag = 'critical'
            else if (sys >= 140 || dia >= 90) flag = 'high'
            else if (sys >= 130 || dia >= 80) flag = 'low' // Stage 1 HTN -- flag for attention

            await sb.from('lab_results').upsert({
              date,
              test_name: 'Blood Pressure (Systolic)',
              value: sys,
              unit: 'mmHg',
              category: 'Vitals',
              flag,
              reference_range_low: 90,
              reference_range_high: 120,
              source_document_id: `withings_bp_${date}`,
            }, { onConflict: 'date,test_name' })

            await sb.from('lab_results').upsert({
              date,
              test_name: 'Blood Pressure (Diastolic)',
              value: dia,
              unit: 'mmHg',
              category: 'Vitals',
              flag,
              reference_range_low: 60,
              reference_range_high: 80,
              source_document_id: `withings_bp_${date}`,
            }, { onConflict: 'date,test_name' })

            totalRecords += 2
          }
        }
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'Withings sync error')
    }

    return {
      integrationId: 'withings',
      success: errors.length === 0,
      recordsSync: totalRecords,
      dateRange: { start: startDate, end: endDate },
      dataTypes: ['weight', 'body_composition', 'blood_pressure'],
      errors,
      duration: Date.now() - syncStart.getTime(),
      syncedAt: new Date().toISOString(),
    }
  },

  async disconnect(): Promise<void> {
    // Withings doesn't have a public revoke endpoint
  },
}

export default withingsConnector
