/**
 * Strava Connector
 *
 * OAuth 2.0 integration with Strava API v3.
 * Pulls: activities (runs, rides, walks, swims), distance, HR, calories.
 *
 * Strava API docs: https://developers.strava.com/docs/reference/
 * Rate limit: 100 requests per 15 minutes, 1000 per day.
 */

import { createServiceClient } from '@/lib/supabase'
import type { Connector, IntegrationConfig, IntegrationToken, SyncResult } from '../types'

const BASE_URL = 'https://www.strava.com/api/v3'
const AUTH_URL = 'https://www.strava.com/oauth/authorize'
const TOKEN_URL = 'https://www.strava.com/oauth/token'

const config: IntegrationConfig = {
  id: 'strava' ,
  name: 'Strava',
  description: 'Running, cycling, and workout activities',
  icon: '\u{1F3C3}',
  category: 'app',
  authType: 'oauth2',
  oauth: {
    authorizeUrl: AUTH_URL,
    tokenUrl: TOKEN_URL,
    clientIdEnvVar: 'STRAVA_CLIENT_ID',
    clientSecretEnvVar: 'STRAVA_CLIENT_SECRET',
    scopes: ['read', 'activity:read'],
    responseType: 'code',
    grantType: 'authorization_code',
  },
  dataTypes: ['workout', 'activity', 'heart_rate', 'calories'],
  syncInterval: 180,
  website: 'https://www.strava.com',
}

const stravaConnector: Connector = {
  config,

  getAuthUrl(redirectUri: string, state: string): string {
    const clientId = process.env[config.oauth!.clientIdEnvVar] ?? ''
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: config.oauth!.scopes.join(','),
      state,
      approval_prompt: 'auto',
    })
    return `${AUTH_URL}?${params.toString()}`
  },

  async exchangeCode(code: string, _redirectUri: string): Promise<IntegrationToken> {
    const clientId = process.env[config.oauth!.clientIdEnvVar] ?? ''
    const clientSecret = process.env[config.oauth!.clientSecretEnvVar] ?? ''

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    })

    if (!res.ok) throw new Error(`Strava token exchange failed: ${await res.text()}`)
    const data = await res.json()
    const now = new Date()

    return {
      id: crypto.randomUUID(),
      integration_id: 'strava' ,
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? null,
      expires_at: new Date((data.expires_at ?? Math.floor(now.getTime() / 1000) + 21600) * 1000).toISOString(),
      scopes: config.oauth!.scopes,
      metadata: { athlete_id: data.athlete?.id },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: token.refresh_token,
        grant_type: 'refresh_token',
      }),
    })

    if (!res.ok) throw new Error('Strava token refresh failed')
    const data = await res.json()
    const now = new Date()

    return {
      ...token,
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? token.refresh_token,
      expires_at: new Date((data.expires_at ?? Math.floor(now.getTime() / 1000) + 21600) * 1000).toISOString(),
      updated_at: now.toISOString(),
    }
  },

  async sync(token: IntegrationToken, startDate: string, endDate: string): Promise<SyncResult> {
    const syncStart = new Date()
    const errors: string[] = []
    let totalRecords = 0
    const sb = createServiceClient()
    const headers = { Authorization: `Bearer ${token.access_token}` }

    const afterEpoch = Math.floor(new Date(startDate).getTime() / 1000)
    const beforeEpoch = Math.floor(new Date(endDate + 'T23:59:59').getTime() / 1000)

    try {
      // Fetch activities (paginated, 30 per page)
      let page = 1
      let hasMore = true

      while (hasMore && page <= 10) { // Max 10 pages = 300 activities
        const res = await fetch(
          `${BASE_URL}/athlete/activities?after=${afterEpoch}&before=${beforeEpoch}&page=${page}&per_page=30`,
          { headers },
        )

        if (!res.ok) {
          if (res.status === 429) {
            errors.push('Strava rate limit reached. Try again in 15 minutes.')
            break
          }
          throw new Error(`Strava activities fetch failed: ${res.status}`)
        }

        const activities = await res.json()
        if (!Array.isArray(activities) || activities.length === 0) {
          hasMore = false
          break
        }

        for (const act of activities) {
          const date = new Date(act.start_date_local ?? act.start_date).toISOString().slice(0, 10)

          // Store as medical_timeline event (activities)
          await sb.from('medical_timeline').insert({
            date,
            event_type: 'test',
            title: `${act.type ?? 'Activity'}: ${act.name ?? 'Workout'}`,
            description: [
              act.distance ? `${(act.distance / 1000).toFixed(1)}km` : null,
              act.moving_time ? `${Math.round(act.moving_time / 60)}min` : null,
              act.average_heartrate ? `avg HR ${Math.round(act.average_heartrate)}` : null,
              act.kilojoules ? `${Math.round(act.kilojoules * 0.239)}cal` : null,
              act.suffer_score ? `effort ${act.suffer_score}` : null,
            ].filter(Boolean).join(' | '),
            significance: 'normal',
            source: 'strava',
          }).then(() => {}, () => {}) // Ignore duplicate errors

          // Also update daily activity metrics
          await sb.from('oura_daily').upsert({
            date,
            cal_active: act.kilojoules ? Math.round(act.kilojoules * 0.239) : null,
            source: 'strava',
          }, { onConflict: 'date' }).then(() => {}, () => {})

          totalRecords++
        }

        if (activities.length < 30) hasMore = false
        page++
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'Strava sync error')
    }

    return {
      integrationId: 'strava' ,
      success: errors.length === 0,
      recordsSync: totalRecords,
      dateRange: { start: startDate, end: endDate },
      dataTypes: ['workout', 'activity', 'heart_rate', 'calories'],
      errors,
      duration: Date.now() - syncStart.getTime(),
      syncedAt: new Date().toISOString(),
    }
  },

  async disconnect(token: IntegrationToken): Promise<void> {
    await fetch('https://www.strava.com/oauth/deauthorize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token.access_token}` },
    }).catch(() => {})
  },
}

export default stravaConnector
