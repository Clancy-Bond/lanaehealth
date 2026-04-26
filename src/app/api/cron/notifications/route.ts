/**
 * Hourly bubble-up cron.
 *
 * Per-subscription:
 *   1. Pull enabled categories.
 *   2. Run evaluators that match those categories.
 *   3. Dispatch via sendNotification(), which is idempotent on
 *      (subscription_id, notification_key).
 *
 * The 5xx-resistant pattern: a single failed dispatch must NOT short
 * the rest of the run. We track sent/skipped/failed counters and
 * return them in the response. 404/410 endpoints are auto-disabled
 * so a stale browser does not retry forever.
 */
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireCronAuth } from '@/lib/cron-auth'
import { trace } from '@/lib/observability/tracing'
import { logError } from '@/lib/observability/log'
import { sendNotification, type SubscriptionRow } from '@/lib/notifications/dispatch'
import {
  evalCyclePrediction,
  evalDailyCheckin,
  evalDoctorVisits,
  evalFertileWindow,
  evalHealthAlerts,
  evalInsurance,
  evalPatternDiscoveries,
} from '@/lib/notifications/evaluators'
import { isValidCategory, type NotificationCategory } from '@/lib/notifications/categories'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

interface RunCounters {
  sent: number
  skipped: number
  failed: number
  errors: string[]
}

function newCounters(): RunCounters {
  return { sent: 0, skipped: 0, failed: 0, errors: [] }
}

async function dispatchAll(
  sub: SubscriptionRow,
  payloads: Array<Awaited<ReturnType<typeof evalCyclePrediction>>>,
  counters: RunCounters,
  sb: ReturnType<typeof createServiceClient>,
): Promise<void> {
  for (const payload of payloads) {
    if (!payload) continue
    const result = await sendNotification(sub, payload)
    if (result.status === 'sent') counters.sent++
    else if (result.status === 'skipped') counters.skipped++
    else {
      counters.failed++
      counters.errors.push(`${sub.id}/${payload.notificationKey}: ${result.error}`)
      if (result.statusCode === 404 || result.statusCode === 410) {
        await sb.from('push_subscriptions').update({ enabled: false }).eq('id', sub.id)
      }
    }
  }
}

async function evaluateForSubscription(
  sub: SubscriptionRow,
  counters: RunCounters,
  sb: ReturnType<typeof createServiceClient>,
): Promise<void> {
  const enabled = new Set<NotificationCategory>(
    sub.enabled_types.filter(isValidCategory),
  )
  if (enabled.size === 0) {
    counters.skipped++
    return
  }

  const queue: Array<Awaited<ReturnType<typeof evalCyclePrediction>>> = []

  if (enabled.has('cycle_predictions')) {
    queue.push(await evalCyclePrediction(sub.timezone))
    queue.push(await evalFertileWindow(sub.timezone))
  }
  if (enabled.has('daily_checkin')) {
    queue.push(await evalDailyCheckin(sub.timezone))
  }
  if (enabled.has('doctor_visits')) {
    const items = await evalDoctorVisits()
    for (const it of items) queue.push(it)
  }
  if (enabled.has('pattern_discoveries')) {
    queue.push(await evalPatternDiscoveries())
  }
  if (enabled.has('health_alerts')) {
    const items = await evalHealthAlerts()
    for (const it of items) queue.push(it)
  }
  if (enabled.has('insurance_reminders')) {
    const items = await evalInsurance()
    for (const it of items) queue.push(it)
  }

  await dispatchAll(sub, queue, counters, sb)
}

export async function POST(req: Request): Promise<Response> {
  return trace(
    { name: 'POST /api/cron/notifications', op: 'cron' },
    async () => handleNotificationsCron(req),
  )
}

async function handleNotificationsCron(req: Request): Promise<Response> {
  const deny = requireCronAuth(req)
  if (deny) return deny

  const sb = createServiceClient()
  const { data: subs, error } = await sb
    .from('push_subscriptions')
    .select('id, endpoint, keys, enabled_types, timezone')
    .eq('enabled', true)

  if (error) {
    // Migration 042 (notification_categories) ships the enabled_types
    // column and the notification_log table. Until it has been applied
    // to the live DB the cron cannot run -- return a structured 503
    // with a descriptive code so ops can spot it on Vercel cron logs.
    if (/enabled_types/i.test(error.message) || /notification_log/i.test(error.message)) {
      return NextResponse.json(
        {
          error: 'migration_042_not_applied',
          detail: error.message,
          remediation:
            'Apply src/lib/migrations/042_notification_categories.sql via the Supabase SQL editor.',
        },
        { status: 503 },
      )
    }
    logError({ context: 'cron/notifications:subs', error: error.message })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const counters = newCounters()
  for (const sub of (subs ?? []) as SubscriptionRow[]) {
    try {
      await evaluateForSubscription(sub, counters, sb)
    } catch (err) {
      counters.failed++
      counters.errors.push(`${sub.id}: ${err instanceof Error ? err.message : 'eval threw'}`)
      logError({
        context: 'cron/notifications:eval',
        error: err,
        tags: { subscription_id: sub.id },
      })
    }
  }

  return NextResponse.json({
    sent: counters.sent,
    skipped: counters.skipped,
    failed: counters.failed,
    errors: counters.errors.slice(0, 10),
    subscriptions: (subs ?? []).length,
  })
}

export async function GET() {
  return NextResponse.json({ ok: true, route: '/api/cron/notifications' })
}
