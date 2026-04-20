import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createServiceClient } from '@/lib/supabase'
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

export async function POST(req: Request) {
  const deny = requireCronAuth(req)
  if (deny) return deny

  if (!PUBLIC_KEY || !PRIVATE_KEY) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
  }

  const sb = createServiceClient()
  const { data: subs, error } = await sb
    .from('push_subscriptions')
    .select('*')
    .eq('enabled', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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

  return NextResponse.json({ sent, skipped, failed, failures: failures.slice(0, 10) })
}

export async function GET() {
  return NextResponse.json({ vapidConfigured: !!(PUBLIC_KEY && PRIVATE_KEY) })
}
