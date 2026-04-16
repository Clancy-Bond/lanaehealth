/**
 * Sync Trigger API
 * POST /api/sync - Run all overdue integration syncs
 * GET /api/sync - Get sync status summary
 *
 * Called by: app load, Vercel cron job, manual sync button
 */

import { NextResponse } from 'next/server'
import { runOverdueSyncs, getSyncSummary } from '@/lib/integrations/sync-scheduler'

export const maxDuration = 120

export async function GET() {
  const summary = await getSyncSummary()
  return NextResponse.json(summary)
}

export async function POST() {
  const results = await runOverdueSyncs()
  return NextResponse.json({
    synced: results.length,
    results: results.map(r => ({
      integration: r.integrationId,
      success: r.success,
      records: r.recordsSync,
      errors: r.errors,
    })),
  })
}
