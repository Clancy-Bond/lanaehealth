/**
 * Pending in-app notifications for the toast surface.
 *
 * Returns recent (last 24h) unread entries from notification_log so the
 * client can show them as a toast even when the user is in the app.
 *
 * If a subscription endpoint is supplied via ?endpoint=, we scope to
 * that device. Otherwise we return rows across all enabled
 * subscriptions in the workspace (single-patient app).
 */
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const endpoint = url.searchParams.get('endpoint')
  const sinceHours = Math.min(48, Math.max(1, Number(url.searchParams.get('hours') ?? '24')))
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString()

  const sb = createServiceClient()
  let subId: string | null = null
  if (endpoint) {
    const { data: sub } = await sb
      .from('push_subscriptions')
      .select('id')
      .eq('endpoint', endpoint)
      .maybeSingle()
    if (sub?.id) subId = sub.id
  }

  let q = sb
    .from('notification_log')
    .select('id, notification_key, category, title, body, url, sent_at, read_at')
    .gte('sent_at', since)
    .is('read_at', null)
    .order('sent_at', { ascending: false })
    .limit(20)

  if (subId) q = q.eq('subscription_id', subId)

  const { data, error } = await q
  if (error) {
    // Migration 042 introduces notification_log. On environments where
    // it has not yet been applied (table missing in the schema cache),
    // degrade silently to an empty list so the home toast surface does
    // not log a 500 every 30 seconds.
    const msg = error.message || ''
    if (
      msg.includes("Could not find the table 'public.notification_log'") ||
      msg.includes('relation "notification_log" does not exist')
    ) {
      return NextResponse.json({ items: [] })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
  return NextResponse.json({ items: data ?? [] })
}
