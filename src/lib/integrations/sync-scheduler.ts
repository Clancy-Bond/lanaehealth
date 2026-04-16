/**
 * Sync Scheduler
 *
 * Manages background sync scheduling for all connected integrations.
 * Each integration has a default sync interval (e.g., Oura every 2 hours,
 * FHIR portal once per day). The scheduler triggers syncs at the right time.
 *
 * In the web-only app, this runs as a cron-like check triggered by:
 * 1. App load (check if any syncs are overdue)
 * 2. API route called by a Vercel cron job
 * 3. Manual sync button in Settings
 */

import { getAllConfigs, getToken, syncIntegration } from './hub'
import { createServiceClient } from '@/lib/supabase'
import type { IntegrationId, SyncResult } from './types'

interface SyncSchedule {
  integrationId: IntegrationId
  intervalMinutes: number
  lastSyncAt: string | null
  nextSyncAt: string | null
  isOverdue: boolean
}

/**
 * Get sync schedules for all connected integrations.
 */
export async function getSyncSchedules(): Promise<SyncSchedule[]> {
  const configs = getAllConfigs()
  const sb = createServiceClient()
  const schedules: SyncSchedule[] = []

  for (const config of configs) {
    const token = await getToken(config.id)
    if (!token) continue // Not connected

    // Find last successful sync from import_history
    const { data: lastSync } = await sb
      .from('import_history')
      .select('imported_at')
      .ilike('source_app', `%${config.name}%`)
      .order('imported_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const lastSyncAt = lastSync?.imported_at ?? token.updated_at
    const nextSyncTime = lastSyncAt
      ? new Date(new Date(lastSyncAt).getTime() + config.syncInterval * 60 * 1000)
      : new Date() // Sync immediately if never synced

    schedules.push({
      integrationId: config.id,
      intervalMinutes: config.syncInterval,
      lastSyncAt,
      nextSyncAt: nextSyncTime.toISOString(),
      isOverdue: new Date() >= nextSyncTime,
    })
  }

  return schedules
}

/**
 * Run all overdue syncs. Call this on app load or from a cron job.
 * Returns results for each integration that was synced.
 */
export async function runOverdueSyncs(): Promise<SyncResult[]> {
  const schedules = await getSyncSchedules()
  const overdue = schedules.filter(s => s.isOverdue)
  const results: SyncResult[] = []

  for (const schedule of overdue) {
    const endDate = new Date().toISOString().slice(0, 10)
    // Sync from last sync date (or 7 days ago if first sync)
    const startDate = schedule.lastSyncAt
      ? new Date(schedule.lastSyncAt).toISOString().slice(0, 10)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const result = await syncIntegration(schedule.integrationId, startDate, endDate)
    results.push(result)
  }

  return results
}

/**
 * Get a summary of all sync statuses for the Settings UI.
 */
export async function getSyncSummary(): Promise<{
  connected: number
  overdue: number
  lastSyncTime: string | null
  schedules: SyncSchedule[]
}> {
  const schedules = await getSyncSchedules()

  return {
    connected: schedules.length,
    overdue: schedules.filter(s => s.isOverdue).length,
    lastSyncTime: schedules
      .map(s => s.lastSyncAt)
      .filter(Boolean)
      .sort()
      .reverse()[0] ?? null,
    schedules,
  }
}
