/**
 * cron_runs audit helpers.
 *
 * Each Vercel cron route should:
 *   1. Call recordCronStart(name) at the top of the handler.
 *   2. On success: recordCronSuccess(runId, summary).
 *   3. On caught error: recordCronFailure(runId, error).
 *
 * The helpers fail soft. If the audit table is missing or the
 * service-role client cannot connect, we log a warning and return a
 * sentinel so the cron itself still runs. Observability must never
 * take down a working cron.
 *
 * The optional `payload_summary` is a short string of counters such as
 * "sent=3 skipped=12 failed=0". Keep it under ~500 chars; never include
 * patient PHI.
 */

import { createServiceClient } from './supabase'
import { logError } from './observability/log'

export type CronRunHandle = string | null

export async function recordCronStart(cronName: string): Promise<CronRunHandle> {
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('cron_runs')
      .insert({ cron_name: cronName, status: 'running' })
      .select('id')
      .single()
    if (error || !data) {
      logError({
        context: 'cron-runs:start',
        error: error?.message ?? 'no row returned',
        tags: { cron_name: cronName },
      })
      return null
    }
    return data.id as string
  } catch (err) {
    logError({
      context: 'cron-runs:start:throw',
      error: err,
      tags: { cron_name: cronName },
    })
    return null
  }
}

export async function recordCronSuccess(
  handle: CronRunHandle,
  payloadSummary?: string,
): Promise<void> {
  if (!handle) return
  try {
    const sb = createServiceClient()
    const startedAt = await loadStartedAt(sb, handle)
    const completedAt = new Date()
    const durationMs = startedAt
      ? completedAt.getTime() - startedAt.getTime()
      : null
    await sb
      .from('cron_runs')
      .update({
        status: 'success',
        completed_at: completedAt.toISOString(),
        duration_ms: durationMs,
        payload_summary: truncate(payloadSummary, 500) ?? null,
      })
      .eq('id', handle)
  } catch (err) {
    logError({ context: 'cron-runs:success', error: err })
  }
}

export async function recordCronFailure(
  handle: CronRunHandle,
  error: unknown,
): Promise<void> {
  if (!handle) return
  try {
    const sb = createServiceClient()
    const startedAt = await loadStartedAt(sb, handle)
    const completedAt = new Date()
    const durationMs = startedAt
      ? completedAt.getTime() - startedAt.getTime()
      : null
    const message =
      error instanceof Error ? error.message : String(error ?? 'unknown error')
    await sb
      .from('cron_runs')
      .update({
        status: 'failed',
        completed_at: completedAt.toISOString(),
        duration_ms: durationMs,
        error_message: truncate(message, 1000),
      })
      .eq('id', handle)
  } catch (err) {
    logError({ context: 'cron-runs:failure', error: err })
  }
}

async function loadStartedAt(
  sb: ReturnType<typeof createServiceClient>,
  handle: string,
): Promise<Date | null> {
  const { data } = await sb
    .from('cron_runs')
    .select('started_at')
    .eq('id', handle)
    .maybeSingle()
  if (!data?.started_at) return null
  return new Date(data.started_at as string)
}

function truncate(s: string | undefined, max: number): string | undefined {
  if (!s) return undefined
  return s.length > max ? `${s.slice(0, max - 3)}...` : s
}
