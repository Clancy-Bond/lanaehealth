import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createServiceClient } from '@/lib/supabase'
import { requireCronAuth, isVercelCron } from '@/lib/cron-auth'
import {
  recordCronStart,
  recordCronSuccess,
  recordCronFailure,
} from '@/lib/cron-runs'

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
  morning_time: string
  evening_time: string
  timezone: string
  last_sent_at: string | null
}

function currentHHMM(timezone: string): string {
  const now = new Date()
  const fmt = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  })
  const parts = fmt.formatToParts(now)
  const h = parts.find(p => p.type === 'hour')?.value ?? '00'
  const m = parts.find(p => p.type === 'minute')?.value ?? '00'
  return `${h.padStart(2, '0')}:${m}`
}

function withinFireWindow(target: string, current: string, windowMinutes = 10): boolean {
  const [th, tm] = target.split(':').map(Number)
  const [ch, cm] = current.split(':').map(Number)
  const targetMin = th * 60 + tm
  const currentMin = ch * 60 + cm
  const diff = currentMin - targetMin
  return diff >= 0 && diff <= windowMinutes
}

function recentlySent(lastSentAt: string | null, minGapMinutes = 30): boolean {
  if (!lastSentAt) return false
  return Date.now() - new Date(lastSentAt).getTime() < minGapMinutes * 60 * 1000
}

async function runDispatch(): Promise<{ sent: number; skipped: number; failed: number; failures: string[] }> {
  const sb = createServiceClient()
  const { data: subs, error } = await sb
    .from('push_subscriptions')
    .select('*')
    .eq('enabled', true)

  if (error) throw new Error(error.message)

  const rows = (subs ?? []) as SubscriptionRow[]
  let sent = 0
  let skipped = 0
  let failed = 0
  const failures: string[] = []

  for (const sub of rows) {
    const now = currentHHMM(sub.timezone)
    const morningHit = withinFireWindow(sub.morning_time, now)
    const eveningHit = withinFireWindow(sub.evening_time, now)
    if (!morningHit && !eveningHit) {
      skipped++
      continue
    }
    if (recentlySent(sub.last_sent_at)) {
      skipped++
      continue
    }

    const payload = morningHit
      ? { title: 'Morning check-in', body: 'Take 30 seconds to log your night.', data: { url: '/log' } }
      : { title: 'Evening check-in', body: 'How was today? A quick tap to log.', data: { url: '/log' } }

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        JSON.stringify(payload)
      )
      await sb.from('push_subscriptions').update({ last_sent_at: new Date().toISOString() }).eq('id', sub.id)
      sent++
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : 'push failed'
      failures.push(`${sub.id}: ${msg}`)
      const statusCode = (err as { statusCode?: number })?.statusCode
      if (statusCode === 404 || statusCode === 410) {
        await sb.from('push_subscriptions').update({ enabled: false }).eq('id', sub.id)
      }
    }
  }

  return { sent, skipped, failed, failures }
}

export async function POST(req: Request) {
  const deny = requireCronAuth(req)
  if (deny) return deny

  if (!PUBLIC_KEY || !PRIVATE_KEY) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
  }

  const runHandle = await recordCronStart('api/push/send')
  try {
    const result = await runDispatch()
    await recordCronSuccess(
      runHandle,
      `sent=${result.sent} skipped=${result.skipped} failed=${result.failed}`,
    )
    return NextResponse.json({ ...result, failures: result.failures.slice(0, 10) })
  } catch (err) {
    await recordCronFailure(runHandle, err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'dispatch failed' },
      { status: 500 },
    )
  }
}

/**
 * Vercel Cron always issues GET, so the scheduled `/api/push/send`
 * entry in vercel.json hit the old config-probe GET below and never
 * actually sent push notifications. We now route authenticated GETs
 * (i.e. Vercel cron with the bearer) to the same dispatch path as
 * POST. Unauthenticated GETs still get the cheap config probe so the
 * existing client-side health check keeps working.
 */
export async function GET(req: Request) {
  if (isVercelCron(req)) {
    if (!PUBLIC_KEY || !PRIVATE_KEY) {
      return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
    }
    const runHandle = await recordCronStart('api/push/send')
    try {
      const result = await runDispatch()
      await recordCronSuccess(
        runHandle,
        `sent=${result.sent} skipped=${result.skipped} failed=${result.failed}`,
      )
      return NextResponse.json({ ...result, failures: result.failures.slice(0, 10) })
    } catch (err) {
      await recordCronFailure(runHandle, err)
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'dispatch failed' },
        { status: 500 },
      )
    }
  }
  return NextResponse.json({ vapidConfigured: !!(PUBLIC_KEY && PRIVATE_KEY) })
}
