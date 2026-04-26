/**
 * GET /api/cron/_health -- ops dashboard for cron observability.
 *
 * Returns:
 *   - jobs[]: per-cron last run timestamp + last success + last failure
 *   - failureCountLast24h: across all crons
 *   - inFlight[]: rows still in 'running' state (likely stuck if older
 *     than the route's maxDuration; reported so ops can investigate)
 *
 * Auth: same CRON_SECRET bearer as the rest of the cron family. The
 * data is non-PHI but the route hits the audit table directly via
 * service-role; we keep it gated so external probes can't surf
 * production cron behaviour. Lanae or future operators can hit it via
 * a quick curl with the secret in their .envrc.
 *
 * Fail-soft: if the cron_runs table is missing (migration 045 not yet
 * applied), the route returns a structured 503 telling ops to apply
 * it. This mirrors the notifications cron's migration_042 fallback.
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireCronAuth } from '@/lib/cron-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const KNOWN_CRONS = [
  'api/sync',
  'api/weather',
  'api/push/send',
  'api/cron/doctor-prep',
  'api/cron/build-status',
  'api/cron/notifications',
] as const

interface CronRunRow {
  id: string
  cron_name: string
  started_at: string
  completed_at: string | null
  status: 'running' | 'success' | 'failed'
  duration_ms: number | null
  payload_summary: string | null
  error_message: string | null
}

interface JobSummary {
  cron_name: string
  last_run_at: string | null
  last_success_at: string | null
  last_failure_at: string | null
  last_status: 'running' | 'success' | 'failed' | 'never_run'
  last_error: string | null
  last_duration_ms: number | null
}

export async function GET(req: Request): Promise<Response> {
  const deny = requireCronAuth(req)
  if (deny) return deny

  const sb = createServiceClient()

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Recent runs: enough headroom that every known cron has at least
  // one entry on a healthy day. Hourly notifications cron means 24
  // rows in 24 hours; we cap at 500 so we never bring back too much.
  const { data: recent, error: recentErr } = await sb
    .from('cron_runs')
    .select('*')
    .gte('started_at', since24h)
    .order('started_at', { ascending: false })
    .limit(500)

  if (recentErr) {
    if (/cron_runs/i.test(recentErr.message)) {
      return NextResponse.json(
        {
          error: 'migration_045_not_applied',
          detail: recentErr.message,
          remediation:
            'Apply src/lib/migrations/045_cron_runs.sql via the Supabase SQL editor.',
        },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: recentErr.message }, { status: 500 })
  }

  const rows = (recent ?? []) as CronRunRow[]

  // Per-cron summary. For each known cron we also need the all-time
  // last success/failure if it does not appear in the 24h window. We
  // batch those lookups to avoid N round trips.
  const jobs: JobSummary[] = []
  for (const name of KNOWN_CRONS) {
    const matching = rows.filter((r) => r.cron_name === name)
    const lastRun = matching[0] ?? null

    let lastSuccess = matching.find((r) => r.status === 'success') ?? null
    let lastFailure = matching.find((r) => r.status === 'failed') ?? null

    if (!lastSuccess) {
      const { data } = await sb
        .from('cron_runs')
        .select('*')
        .eq('cron_name', name)
        .eq('status', 'success')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data) lastSuccess = data as CronRunRow
    }
    if (!lastFailure) {
      const { data } = await sb
        .from('cron_runs')
        .select('*')
        .eq('cron_name', name)
        .eq('status', 'failed')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data) lastFailure = data as CronRunRow
    }

    jobs.push({
      cron_name: name,
      last_run_at: lastRun?.started_at ?? null,
      last_success_at: lastSuccess?.completed_at ?? lastSuccess?.started_at ?? null,
      last_failure_at: lastFailure?.completed_at ?? lastFailure?.started_at ?? null,
      last_status: lastRun?.status ?? 'never_run',
      last_error: lastFailure?.error_message ?? null,
      last_duration_ms: lastRun?.duration_ms ?? null,
    })
  }

  const failureCountLast24h = rows.filter((r) => r.status === 'failed').length

  // Anything still 'running' after we expect it to be done is suspect.
  // We surface it as 'inFlight' with the start time so ops can decide.
  const inFlight = rows
    .filter((r) => r.status === 'running')
    .map((r) => ({
      cron_name: r.cron_name,
      started_at: r.started_at,
      age_seconds: Math.floor(
        (Date.now() - new Date(r.started_at).getTime()) / 1000,
      ),
    }))

  return NextResponse.json({
    jobs,
    failureCountLast24h,
    inFlight,
    generatedAt: new Date().toISOString(),
  })
}
