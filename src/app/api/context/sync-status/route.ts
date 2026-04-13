/**
 * Sync Status - API Route
 *
 * GET - Returns detailed sync status information:
 *   - Total records in health_embeddings
 *   - Date range of indexed data
 *   - Records broken down by content_type
 *   - Whether a sync is currently running
 *   - Last sync timestamp (most recent updated_at)
 */

import { createServiceClient } from '@/lib/supabase'

// In-memory sync state (shared across requests in the same process)
let syncRunning = false
let lastSyncAt: string | null = null
let lastSyncRecords: number | null = null

export function setSyncRunning(running: boolean) {
  syncRunning = running
  if (!running) {
    lastSyncAt = new Date().toISOString()
  }
}

export function setLastSyncRecords(count: number) {
  lastSyncRecords = count
}

export function isSyncRunning() {
  return syncRunning
}

export async function GET() {
  try {
    const sb = createServiceClient()

    // Run all stat queries in parallel
    const [totalRes, earliestRes, latestRes, typeRes, lastUpdatedRes] = await Promise.all([
      // Total count
      sb.from('health_embeddings')
        .select('id', { count: 'exact', head: true }),

      // Earliest date
      sb.from('health_embeddings')
        .select('content_date')
        .order('content_date', { ascending: true })
        .limit(1),

      // Latest date
      sb.from('health_embeddings')
        .select('content_date')
        .order('content_date', { ascending: false })
        .limit(1),

      // All content types for grouping
      sb.from('health_embeddings')
        .select('content_type'),

      // Most recent updated_at as last sync indicator
      sb.from('health_embeddings')
        .select('updated_at')
        .order('updated_at', { ascending: false })
        .limit(1),
    ])

    const totalRecords = totalRes.count ?? 0
    const earliest = earliestRes.data?.[0]?.content_date ?? null
    const latest = latestRes.data?.[0]?.content_date ?? null
    const dbLastUpdated = lastUpdatedRes.data?.[0]?.updated_at ?? null

    // Count by type
    const byType: Record<string, number> = {}
    for (const row of typeRes.data ?? []) {
      const t = row.content_type as string
      byType[t] = (byType[t] ?? 0) + 1
    }

    return Response.json({
      totalRecords,
      dateRange: {
        earliest,
        latest,
      },
      byType,
      syncRunning,
      lastSyncAt: lastSyncAt ?? dbLastUpdated,
      lastSyncRecords,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Sync status error:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
