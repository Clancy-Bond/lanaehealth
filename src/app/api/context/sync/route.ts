/**
 * Layer 3 Sync Pipeline - API Route
 *
 * POST - Syncs health data narratives into the vector store.
 *
 * Body options:
 *   { full: true }                    - Sync all history (2022-01-01 to today)
 *   { start: "2026-03-01", end: "2026-04-12" } - Sync specific date range
 *   {} (empty)                        - Default: sync last 90 days
 *
 * GET - Returns vector store stats (row counts, date range, types)
 */

import { syncDateRange, syncAllHistory } from '@/lib/context/sync-pipeline'
import { getVectorStoreStats } from '@/lib/context/vector-store'
import {
  setSyncRunning,
  setLastSyncRecords,
  isSyncRunning,
} from '@/app/api/context/sync-status/route'
import { maybeTriggerAnalysis } from '@/lib/intelligence/auto-trigger'
import { requireAuth } from '@/lib/auth/require-user'

export const maxDuration = 300

export async function POST(request: Request) {
  const gate = requireAuth(request)
  if (!gate.ok) return gate.response

  // Prevent concurrent syncs
  if (isSyncRunning()) {
    return Response.json(
      { error: 'A sync is already running. Please wait for it to finish.' },
      { status: 409 },
    )
  }

  setSyncRunning(true)

  try {
    const body = await request.json().catch(() => ({})) as {
      full?: boolean
      start?: string
      end?: string
    }

    let synced: number

    if (body.full) {
      // Full history sync
      console.log('Starting full history sync...')
      synced = await syncAllHistory()
    } else {
      // Date range sync (default: last 90 days)
      const today = new Date()
      const ninetyDaysAgo = new Date(today)
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

      const startDate = body.start ?? ninetyDaysAgo.toISOString().split('T')[0]
      const endDate = body.end ?? today.toISOString().split('T')[0]

      console.log(`Syncing ${startDate} to ${endDate}...`)
      synced = await syncDateRange(startDate, endDate)
    }

    setLastSyncRecords(synced)

    // Trigger clinical intelligence analysis if significant data synced
    await maybeTriggerAnalysis('sync_pipeline', synced)

    setSyncRunning(false)

    // Get updated stats
    const stats = await getVectorStoreStats()

    return Response.json({
      synced,
      stats,
    })
  } catch (error: unknown) {
    setSyncRunning(false)
    const message = error instanceof Error ? error.message : String(error)
    console.error('Sync pipeline error:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const gate = requireAuth(request)
  if (!gate.ok) return gate.response

  try {
    const stats = await getVectorStoreStats()
    return Response.json(stats)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ error: message }, { status: 500 })
  }
}
