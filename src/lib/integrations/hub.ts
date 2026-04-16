/**
 * Integration Hub -- Central Registry
 *
 * Manages all integrations: registration, token storage, sync orchestration.
 * Each connector registers itself here. The Settings UI queries the hub
 * for available integrations and their status.
 */

import { createServiceClient } from '@/lib/supabase'
import type {
  IntegrationId, IntegrationConfig, IntegrationToken,
  IntegrationStatus, Connector, SyncResult,
} from './types'

// ── Registry ───────────────────────────────────────────────────────

const connectors = new Map<IntegrationId, Connector>()

export function registerConnector(connector: Connector): void {
  connectors.set(connector.config.id, connector)
}

export function getConnector(id: IntegrationId): Connector | undefined {
  return connectors.get(id)
}

export function getAllConfigs(): IntegrationConfig[] {
  return Array.from(connectors.values()).map(c => c.config)
}

// ── Token Management ───────────────────────────────────────────────

const TOKENS_TABLE = 'integration_tokens'

export async function getToken(integrationId: IntegrationId): Promise<IntegrationToken | null> {
  const sb = createServiceClient()
  const { data } = await sb
    .from(TOKENS_TABLE)
    .select('*')
    .eq('integration_id', integrationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data as IntegrationToken | null
}

export async function saveToken(token: IntegrationToken): Promise<void> {
  const sb = createServiceClient()
  await sb.from(TOKENS_TABLE).upsert({
    integration_id: token.integration_id,
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_at: token.expires_at,
    scopes: token.scopes,
    metadata: token.metadata,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'integration_id' })
}

export async function deleteToken(integrationId: IntegrationId): Promise<void> {
  const sb = createServiceClient()
  await sb.from(TOKENS_TABLE).delete().eq('integration_id', integrationId)
}

// ── Status Check ───────────────────────────────────────────────────

export async function getStatus(integrationId: IntegrationId): Promise<IntegrationStatus> {
  const token = await getToken(integrationId)
  if (!token) return 'disconnected'

  const expiresAt = new Date(token.expires_at)
  const now = new Date()

  if (expiresAt < now) return 'expired'
  return 'connected'
}

export async function getAllStatuses(): Promise<Record<IntegrationId, IntegrationStatus>> {
  const statuses: Record<string, IntegrationStatus> = {}
  for (const id of connectors.keys()) {
    statuses[id] = await getStatus(id)
  }
  return statuses as Record<IntegrationId, IntegrationStatus>
}

// ── Sync Orchestration ─────────────────────────────────────────────

/**
 * Sync a specific integration. Handles token refresh if needed.
 */
export async function syncIntegration(
  integrationId: IntegrationId,
  startDate: string,
  endDate: string,
): Promise<SyncResult> {
  const connector = getConnector(integrationId)
  if (!connector) {
    return {
      integrationId,
      success: false,
      recordsSync: 0,
      dateRange: null,
      dataTypes: [],
      errors: [`No connector registered for ${integrationId}`],
      duration: 0,
      syncedAt: new Date().toISOString(),
    }
  }

  let token = await getToken(integrationId)
  if (!token) {
    return {
      integrationId,
      success: false,
      recordsSync: 0,
      dateRange: null,
      dataTypes: [],
      errors: ['Not connected. Please authorize first.'],
      duration: 0,
      syncedAt: new Date().toISOString(),
    }
  }

  // Auto-refresh if expired
  const expiresAt = new Date(token.expires_at)
  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000)
  if (expiresAt < fiveMinFromNow && token.refresh_token) {
    try {
      token = await connector.refreshToken(token)
      await saveToken(token)
    } catch (e) {
      return {
        integrationId,
        success: false,
        recordsSync: 0,
        dateRange: null,
        dataTypes: [],
        errors: [`Token refresh failed: ${e instanceof Error ? e.message : 'Unknown'}`],
        duration: 0,
        syncedAt: new Date().toISOString(),
      }
    }
  }

  const start = Date.now()
  try {
    const result = await connector.sync(token, startDate, endDate)
    return { ...result, duration: Date.now() - start }
  } catch (e) {
    return {
      integrationId,
      success: false,
      recordsSync: 0,
      dateRange: null,
      dataTypes: [],
      errors: [`Sync failed: ${e instanceof Error ? e.message : 'Unknown'}`],
      duration: Date.now() - start,
      syncedAt: new Date().toISOString(),
    }
  }
}
