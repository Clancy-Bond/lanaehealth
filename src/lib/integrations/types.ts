/**
 * Integration Hub -- Shared Types
 *
 * All wearable and app connectors implement the Connector interface.
 * OAuth flows, sync scheduling, and data mapping are standardized.
 */

// ── Integration Configuration ──────────────────────────────────────

export type IntegrationId =
  | 'oura'
  | 'dexcom'
  | 'whoop'
  | 'garmin'
  | 'withings'
  | 'fitbit'
  | 'libre'
  | 'strava'
  | 'fhir-portal'

export type IntegrationStatus = 'disconnected' | 'connected' | 'syncing' | 'error' | 'expired'

export interface IntegrationConfig {
  id: IntegrationId
  name: string
  description: string
  icon: string                    // Emoji or icon identifier
  category: 'wearable' | 'cgm' | 'scale' | 'medical' | 'app'
  authType: 'oauth2' | 'api_key' | 'smart_fhir'
  oauth?: OAuthConfig
  dataTypes: DataType[]           // What data this integration provides
  syncInterval: number            // Default sync interval in minutes
  website: string
}

export interface OAuthConfig {
  authorizeUrl: string
  tokenUrl: string
  clientIdEnvVar: string          // Environment variable name for client ID
  clientSecretEnvVar: string      // Environment variable name for client secret
  scopes: string[]
  responseType: 'code'
  grantType: 'authorization_code'
  pkce?: boolean                  // Use PKCE flow
}

export type DataType =
  | 'sleep'
  | 'heart_rate'
  | 'hrv'
  | 'spo2'
  | 'temperature'
  | 'respiratory_rate'
  | 'stress'
  | 'activity'
  | 'steps'
  | 'calories'
  | 'workout'
  | 'readiness'
  | 'recovery'
  | 'blood_glucose'
  | 'blood_pressure'
  | 'weight'
  | 'body_composition'
  | 'medical_records'
  | 'labs'
  | 'medications'
  | 'conditions'

// ── Token Storage ──────────────────────────────────────────────────

export interface IntegrationToken {
  id: string
  integration_id: IntegrationId
  access_token: string
  refresh_token: string | null
  expires_at: string              // ISO datetime
  scopes: string[]
  metadata: Record<string, unknown> // Extra provider-specific data
  created_at: string
  updated_at: string
}

// ── Sync Results ───────────────────────────────────────────────────

export interface SyncResult {
  integrationId: IntegrationId
  success: boolean
  recordsSync: number
  dateRange: { start: string; end: string } | null
  dataTypes: DataType[]
  errors: string[]
  duration: number                // milliseconds
  syncedAt: string                // ISO datetime
}

// ── Connector Interface ────────────────────────────────────────────

export interface Connector {
  config: IntegrationConfig

  /** Build the OAuth authorization URL for user redirect */
  getAuthUrl(redirectUri: string, state: string): string

  /** Exchange authorization code for tokens */
  exchangeCode(code: string, redirectUri: string): Promise<IntegrationToken>

  /** Refresh an expired access token */
  refreshToken(token: IntegrationToken): Promise<IntegrationToken>

  /** Sync data from the provider for a date range */
  sync(token: IntegrationToken, startDate: string, endDate: string): Promise<SyncResult>

  /** Disconnect / revoke tokens */
  disconnect(token: IntegrationToken): Promise<void>
}
