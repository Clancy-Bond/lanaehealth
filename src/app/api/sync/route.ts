/**
 * Sync Trigger API
 * GET  /api/sync - Vercel cron entry point; runs overdue syncs.
 * POST /api/sync - Manual trigger (also cron-auth gated).
 *
 * Auth: every method requires `Authorization: Bearer $CRON_SECRET`.
 * Without it the route 401s, fail-closed. See C-001.
 */

import { NextResponse } from 'next/server'
import { runOverdueSyncs, getSyncSummary } from '@/lib/integrations/sync-scheduler'
import { requireCronAuth } from '@/lib/cron-auth'
import {
  recordCronStart,
  recordCronSuccess,
  recordCronFailure,
} from '@/lib/cron-runs'

export const maxDuration = 120

export async function GET(req: Request) {
  const deny = requireCronAuth(req)
  if (deny) return deny
  const runHandle = await recordCronStart('api/sync')
  try {
    const results = await runOverdueSyncs()
    const summary = await getSyncSummary()
    const successCount = results.filter(r => r.success).length
    await recordCronSuccess(
      runHandle,
      `total=${results.length} success=${successCount} failed=${results.length - successCount}`,
    )
    return NextResponse.json({
      synced: results.length,
      results: results.map(r => ({
        integration: r.integrationId,
        success: r.success,
        records: r.recordsSync,
        errors: r.errors,
      })),
      summary,
    })
  } catch (err) {
    await recordCronFailure(runHandle, err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'sync failed' },
      { status: 500 },
    )
  }
}

export async function POST(req: Request) {
  const deny = requireCronAuth(req)
  if (deny) return deny
  const runHandle = await recordCronStart('api/sync')
  try {
    const results = await runOverdueSyncs()
    const successCount = results.filter(r => r.success).length
    await recordCronSuccess(
      runHandle,
      `total=${results.length} success=${successCount} failed=${results.length - successCount}`,
    )
    return NextResponse.json({
      synced: results.length,
      results: results.map(r => ({
        integration: r.integrationId,
        success: r.success,
        records: r.recordsSync,
        errors: r.errors,
      })),
    })
  } catch (err) {
    await recordCronFailure(runHandle, err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'sync failed' },
      { status: 500 },
    )
  }
}
