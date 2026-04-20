// ---------------------------------------------------------------------------
// POST /api/push/prn-poll
//
// Cron target for the Wave 2e PRN post-dose efficacy polling feature
// (Brief F7). On each tick, dispatches push notifications for any
// prn_dose_events whose poll_scheduled_for has passed and whose
// poll_sent_at is still NULL.
//
// Auth: matches the pattern in /api/push/send. If CRON_SECRET is set,
// the request must carry `Authorization: Bearer <CRON_SECRET>`.
//
// Voice: the notification body is always "Did [med] help?" - NEVER
// "Did you take [med]?". See prn_dose_events migration comments.
//
// iOS PWA caveat: push delivery may silently fail on iOS. The
// PrnEffectivenessPoll component renders an in-app fallback on /log
// using getOpenInAppPolls() so Lanae can still answer from the app.
//
// GET returns a health summary useful for debugging cron wiring.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createServiceClient } from '@/lib/supabase'
import { getPendingPolls, markPollSent } from '@/lib/api/prn-doses'
import { requireCronAuth } from '@/lib/cron-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? ''
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? ''
const CONTACT = process.env.VAPID_CONTACT ?? 'mailto:noreply@lanaehealth.local'

if (PUBLIC_KEY && PRIVATE_KEY) {
  webpush.setVapidDetails(CONTACT, PUBLIC_KEY, PRIVATE_KEY)
}

interface SubscriptionRow {
  id: string
  endpoint: string
  keys: { p256dh: string; auth: string }
  enabled: boolean
}

function buildNotificationPayload(medicationName: string, doseEventId: string) {
  return {
    title: 'Quick check-in',
    // Voice rule: ask if it helped, do not re-confirm the dose itself.
    body: `Did ${medicationName} help?`,
    data: {
      url: `/log?prn_poll=${doseEventId}`,
      doseEventId,
      kind: 'prn_efficacy_poll',
    },
  }
}

export async function POST(req: Request) {
  const deny = requireCronAuth(req)
  if (deny) return deny

  if (!PUBLIC_KEY || !PRIVATE_KEY) {
    // Not a hard failure; the in-app fallback still lets Lanae answer
    // via /log. We just can't fire push, so return 200 with zero sent
    // and a warning so dashboards can spot mis-config.
    return NextResponse.json({
      sent: 0,
      failed: 0,
      skipped: 0,
      pending: 0,
      warning: 'VAPID keys not configured; skipping push dispatch',
    })
  }

  const sb = createServiceClient()

  // 1. Fetch all enabled subscriptions up front - same pattern as
  //    /api/push/send. If there are no subscriptions, we still mark
  //    polls "sent" so the in-app fallback can take over.
  const { data: subs, error: subsErr } = await sb
    .from('push_subscriptions')
    .select('id, endpoint, keys, enabled')
    .eq('enabled', true)

  if (subsErr) {
    return NextResponse.json({ error: subsErr.message }, { status: 500 })
  }

  const subscriptions = (subs ?? []) as SubscriptionRow[]

  // 2. Fetch pending polls in FIFO order.
  let pending
  try {
    pending = await getPendingPolls(50)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'failed to fetch polls'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  let sent = 0
  let failed = 0
  let skipped = 0
  const failures: string[] = []

  for (const dose of pending) {
    const payload = buildNotificationPayload(dose.medication_name, dose.id)

    if (subscriptions.length === 0) {
      // No active subscriptions. Mark the poll as "sent" so it surfaces
      // in the in-app fallback immediately; we do not loop forever
      // on undeliverable rows.
      try {
        await markPollSent(dose.id)
        skipped++
      } catch {
        failed++
      }
      continue
    }

    let anyDelivered = false
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          JSON.stringify(payload),
        )
        anyDelivered = true
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode
        const msg = err instanceof Error ? err.message : 'push failed'
        failures.push(`${sub.id}: ${msg}`)
        if (statusCode === 404 || statusCode === 410) {
          // Stale subscription. Disable so we stop hitting it.
          await sb
            .from('push_subscriptions')
            .update({ enabled: false })
            .eq('id', sub.id)
        }
      }
    }

    try {
      // Whether or not any push delivered, stamp poll_sent_at so the
      // in-app fallback surfaces this row (and we never re-dispatch).
      // iOS PWA unreliability is exactly why the fallback path exists.
      await markPollSent(dose.id)
      if (anyDelivered) sent++
      else failed++
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : 'mark sent failed'
      failures.push(`${dose.id}: ${msg}`)
    }
  }

  return NextResponse.json({
    sent,
    failed,
    skipped,
    pending: pending.length,
    subscriptions: subscriptions.length,
    failures: failures.slice(0, 10),
  })
}

export async function GET() {
  return NextResponse.json({
    vapidConfigured: !!(PUBLIC_KEY && PRIVATE_KEY),
    note: 'POST with Authorization: Bearer <CRON_SECRET> to dispatch pending PRN efficacy polls.',
  })
}
