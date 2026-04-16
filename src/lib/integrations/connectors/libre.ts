/**
 * Abbott FreeStyle Libre CGM Connector
 *
 * Integration with LibreView API for glucose monitoring data.
 * Pulls: glucose readings (up to 1,440/day with Libre 3), AGP data.
 *
 * LibreView API requires a patient-initiated data sharing connection.
 * The user must connect their LibreView account through the Abbott portal.
 *
 * NOTE: LibreView integration typically requires a formal partnership with Abbott.
 * This connector implements the expected OAuth + data retrieval pattern.
 * Actual API endpoints may differ once partnership is established.
 */

import { createServiceClient } from '@/lib/supabase'
import type { Connector, IntegrationConfig, IntegrationToken, SyncResult } from '../types'

const BASE_URL = 'https://api.libreview.io'
const AUTH_URL = 'https://api.libreview.io/llu/auth/login'

const config: IntegrationConfig = {
  id: 'libre',
  name: 'FreeStyle Libre',
  description: 'Continuous glucose monitoring from Abbott Libre sensors',
  icon: '\u{1FA78}',
  category: 'cgm',
  authType: 'api_key', // LibreView uses email/password auth, not standard OAuth
  dataTypes: ['blood_glucose'],
  syncInterval: 60,
  website: 'https://www.libreview.com',
}

const libreConnector: Connector = {
  config,

  getAuthUrl(_redirectUri: string, _state: string): string {
    // LibreView doesn't use standard OAuth redirect
    // Auth is handled via API login with email/password
    return '/settings?integration=libre&action=login'
  },

  async exchangeCode(code: string, _redirectUri: string): Promise<IntegrationToken> {
    // LibreView uses email/password login, not OAuth code exchange
    // The "code" here is actually a JSON string with { email, password }
    let credentials: { email: string; password: string }
    try {
      credentials = JSON.parse(code)
    } catch {
      throw new Error('Invalid credentials format. Expected { email, password }')
    }

    const res = await fetch(AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'product': 'llu.android',
        'version': '4.7',
      },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
      }),
    })

    if (!res.ok) throw new Error('LibreView login failed. Check email and password.')
    const data = await res.json()

    if (data.status !== 0) {
      throw new Error(data.error?.message ?? 'LibreView authentication failed')
    }

    const authTicket = data.data?.authTicket
    if (!authTicket?.token) throw new Error('No auth token received from LibreView')

    const now = new Date()

    return {
      id: crypto.randomUUID(),
      integration_id: 'libre',
      access_token: authTicket.token,
      refresh_token: null,
      expires_at: new Date(now.getTime() + (authTicket.duration ?? 86400) * 1000).toISOString(),
      scopes: [],
      metadata: {
        account_id: data.data?.user?.id,
        patient_id: data.data?.user?.id,
      },
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    }
  },

  async refreshToken(token: IntegrationToken): Promise<IntegrationToken> {
    // LibreView tokens can't be refreshed -- user must re-authenticate
    throw new Error('LibreView tokens cannot be refreshed. Please reconnect.')
  },

  async sync(token: IntegrationToken, startDate: string, endDate: string): Promise<SyncResult> {
    const syncStart = new Date()
    const errors: string[] = []
    let totalRecords = 0
    const sb = createServiceClient()

    const headers = {
      Authorization: `Bearer ${token.access_token}`,
      'product': 'llu.android',
      'version': '4.7',
    }

    try {
      // Fetch connections (patients linked to this account)
      const connRes = await fetch(`${BASE_URL}/llu/connections`, { headers })
      if (!connRes.ok) throw new Error('Failed to fetch LibreView connections')

      const connData = await connRes.json()
      const connections = connData.data ?? []

      if (connections.length === 0) {
        errors.push('No sensor connections found in LibreView account')
        return {
          integrationId: 'libre',
          success: false,
          recordsSync: 0,
          dateRange: null,
          dataTypes: ['blood_glucose'],
          errors,
          duration: Date.now() - syncStart.getTime(),
          syncedAt: new Date().toISOString(),
        }
      }

      // Get glucose data from the first (primary) connection
      const patientId = connections[0].patientId
      const graphRes = await fetch(`${BASE_URL}/llu/connections/${patientId}/graph`, { headers })

      if (!graphRes.ok) throw new Error('Failed to fetch glucose data')
      const graphData = await graphRes.json()

      const glucoseItems = graphData.data?.graphData ?? []

      // Aggregate by day
      const dailyReadings = new Map<string, number[]>()

      for (const item of glucoseItems) {
        const timestamp = item.Timestamp ?? item.FactoryTimestamp
        if (!timestamp) continue

        const date = new Date(timestamp).toISOString().slice(0, 10)
        if (date < startDate || date > endDate) continue

        const value = item.ValueInMgPerDl ?? item.Value
        if (typeof value !== 'number') continue

        if (!dailyReadings.has(date)) dailyReadings.set(date, [])
        dailyReadings.get(date)!.push(value)
      }

      for (const [date, values] of dailyReadings) {
        const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length)
        const min = Math.min(...values)
        const max = Math.max(...values)
        const timeInRange = Math.round(values.filter(v => v >= 70 && v <= 180).length / values.length * 100)

        await sb.from('lab_results').upsert({
          date,
          test_name: 'Glucose (CGM Average)',
          value: avg,
          unit: 'mg/dL',
          category: 'CGM',
          flag: avg > 180 ? 'high' : avg < 70 ? 'low' : 'normal',
          reference_range_low: 70,
          reference_range_high: 180,
          source_document_id: `libre_${date}`,
        }, { onConflict: 'date,test_name' })

        await sb.from('lab_results').upsert({
          date,
          test_name: 'Time in Range (CGM)',
          value: timeInRange,
          unit: '%',
          category: 'CGM',
          flag: timeInRange >= 70 ? 'normal' : 'low',
          source_document_id: `libre_${date}`,
        }, { onConflict: 'date,test_name' })

        totalRecords += 2
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'Libre sync error')
    }

    return {
      integrationId: 'libre',
      success: errors.length === 0,
      recordsSync: totalRecords,
      dateRange: { start: startDate, end: endDate },
      dataTypes: ['blood_glucose'],
      errors,
      duration: Date.now() - syncStart.getTime(),
      syncedAt: new Date().toISOString(),
    }
  },

  async disconnect(): Promise<void> {
    // LibreView tokens just expire -- no revocation endpoint
  },
}

export default libreConnector
