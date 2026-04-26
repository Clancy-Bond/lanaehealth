/**
 * Server-side notification dispatch.
 *
 * sendNotification(): wraps web-push with idempotency. Inserts into
 * notification_log first with a unique (subscription_id, notification_key).
 * If the insert conflicts, the notification was already sent and we
 * return { skipped: true }. This is the bubble-up duplicate guard the
 * cron task relies on so a re-run inside the 1-hour window does not
 * fire twice.
 *
 * Caller MUST pass a stable notification_key. Examples:
 *   cycle:predict:2026-04-30        -> period likely starting
 *   cycle:fertile:2026-04-22        -> fertile window opening today
 *   appt:24h:<id>                   -> 24h before appointment
 *   appt:1h:<id>                    -> 1h before appointment
 *   pattern:<hash>                  -> a pattern discovery
 *   health:<problem_id>:<status>    -> a red-flag status change
 *   checkin:daily:2026-04-25        -> the day's daily nudge
 *
 * Date components in the key MUST be the user's local date so the
 * idempotency boundary aligns with how a person reads "today".
 */
import webpush from 'web-push'
import { createServiceClient } from '@/lib/supabase'
import type { NotificationCategory } from './categories'

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? ''
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? ''
const CONTACT = process.env.VAPID_CONTACT ?? 'mailto:noreply@lanaehealth.local'

let vapidConfigured = false
function ensureVapid(): boolean {
  if (vapidConfigured) return true
  if (!PUBLIC_KEY || !PRIVATE_KEY) return false
  webpush.setVapidDetails(CONTACT, PUBLIC_KEY, PRIVATE_KEY)
  vapidConfigured = true
  return true
}

export interface SubscriptionRow {
  id: string
  endpoint: string
  keys: { p256dh: string; auth: string }
  enabled_types: string[]
  timezone: string
}

export interface NotificationPayload {
  category: NotificationCategory
  notificationKey: string
  title: string
  body: string
  url?: string
  /** Optional ISO timestamp the cron evaluated against. For analytics only. */
  evaluatedAt?: string
}

export type DispatchResult =
  | { status: 'sent'; logId: string }
  | { status: 'skipped'; reason: 'duplicate' | 'category_off' }
  | { status: 'failed'; error: string; statusCode?: number }

/**
 * Idempotent push dispatch. Records to notification_log first, then
 * fires web-push. If the log insert conflicts (key already used for
 * this subscription) we treat it as already-sent and return skipped.
 *
 * Returns failed when the subscription has 404/410 (gone) so the
 * caller can disable the row.
 */
export async function sendNotification(
  sub: SubscriptionRow,
  payload: NotificationPayload,
): Promise<DispatchResult> {
  if (!sub.enabled_types.includes(payload.category)) {
    return { status: 'skipped', reason: 'category_off' }
  }
  if (!ensureVapid()) {
    return { status: 'failed', error: 'VAPID keys not configured' }
  }

  const sb = createServiceClient()

  // Reserve the slot. The unique index on (subscription_id, notification_key)
  // is the idempotency guard. If two cron runs overlap, exactly one wins.
  const { data: logRow, error: insertErr } = await sb
    .from('notification_log')
    .insert({
      subscription_id: sub.id,
      notification_key: payload.notificationKey,
      category: payload.category,
      title: payload.title,
      body: payload.body,
      url: payload.url ?? null,
    })
    .select('id')
    .single()

  if (insertErr) {
    // 23505 = unique_violation in Postgres
    if (insertErr.code === '23505') {
      return { status: 'skipped', reason: 'duplicate' }
    }
    return { status: 'failed', error: insertErr.message }
  }

  const wirePayload = {
    title: payload.title,
    body: payload.body,
    tag: `${payload.category}:${payload.notificationKey}`,
    data: { url: payload.url ?? '/v2', category: payload.category, key: payload.notificationKey },
  }

  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: sub.keys },
      JSON.stringify(wirePayload),
    )
    return { status: 'sent', logId: logRow.id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'push failed'
    const statusCode = (err as { statusCode?: number })?.statusCode
    // Record the failure on the log row so retries aren't silent.
    await sb
      .from('notification_log')
      .update({ delivered: false, error: msg })
      .eq('id', logRow.id)
    return { status: 'failed', error: msg, statusCode }
  }
}
