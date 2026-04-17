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

export const dynamic = 'force-dynamic'
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

// Known content_type values produced by src/lib/context/sync-pipeline.ts.
// Kept in sync with that file -- extend here when new indexers are added.
const KNOWN_CONTENT_TYPES = ['daily_log', 'lab_result', 'imaging'] as const

export async function GET() {
  try {
    const sb = createServiceClient()

    // Issue one count-only HEAD query per known content_type. Supabase caps
    // .select('content_type') at 1000 rows, which silently truncated the
    // per-type breakdown before this fix (see 2026-04-16 sync-status finding).
    // HEAD + count: 'exact' returns a true PG COUNT(*) with no row payload.
    const typeCountPromises = KNOWN_CONTENT_TYPES.map((t) =>
      sb.from('health_embeddings')
        .select('*', { count: 'exact', head: true })
        .eq('content_type', t)
        .then((res) => ({ type: t, count: res.count ?? 0 })),
    )

    // Run all stat queries in parallel
    const [totalRes, earliestRes, latestRes, lastUpdatedRes, ...typeResults] = await Promise.all([
      // Total count (independent -- catches any untyped/unknown rows too)
      sb.from('health_embeddings')
        .select('*', { count: 'exact', head: true }),

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

      // Most recent updated_at as last sync indicator
      sb.from('health_embeddings')
        .select('updated_at')
        .order('updated_at', { ascending: false })
        .limit(1),

      // Per-type HEAD counts (spread so Promise.all resolves them here too)
      ...typeCountPromises,
    ])

    const totalRecords = totalRes.count ?? 0
    const earliest = earliestRes.data?.[0]?.content_date ?? null
    const latest = latestRes.data?.[0]?.content_date ?? null
    const dbLastUpdated = lastUpdatedRes.data?.[0]?.updated_at ?? null

    // Build per-type breakdown from the HEAD count results
    const byType: Record<string, number> = {}
    for (const r of typeResults) {
      byType[r.type] = r.count
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
