/**
 * v2 push subscription endpoint.
 *
 * Differs from the legacy /api/push/subscribe (which only handled
 * morning/evening check-in times) by accepting an enabled_types
 * array so the cron knows which categorized triggers to evaluate.
 *
 * Defaults to NO categories so a fresh subscription gets nothing
 * until the user opts in. The legacy route stays alive for the
 * existing CheckInReminders surface.
 */
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { isValidCategory } from '@/lib/notifications/categories'

export const dynamic = 'force-dynamic'

interface SubscribePayload {
  endpoint: string
  keys: { p256dh: string; auth: string }
  enabledTypes?: string[]
  timezone?: string
}

export async function POST(req: Request) {
  let body: SubscribePayload
  try {
    body = (await req.json()) as SubscribePayload
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: 'endpoint and keys required' }, { status: 400 })
  }

  const enabledTypes = (body.enabledTypes ?? []).filter(isValidCategory)
  const sb = createServiceClient()
  const userAgent = req.headers.get('user-agent') ?? null

  const { data, error } = await sb
    .from('push_subscriptions')
    .upsert(
      {
        endpoint: body.endpoint,
        keys: body.keys,
        user_agent: userAgent,
        timezone: body.timezone ?? 'Pacific/Honolulu',
        enabled: true,
        enabled_types: enabledTypes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    )
    .select('id, enabled_types')
    .single()

  if (error) {
    // Same migration-042 surface as the cron route. Returning 503 lets
    // the settings UI render a helpful error instead of a generic 500.
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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, id: data.id, enabledTypes: data.enabled_types })
}

export async function DELETE(req: Request) {
  const url = new URL(req.url)
  const endpoint = url.searchParams.get('endpoint')
  if (!endpoint) return NextResponse.json({ error: 'endpoint required' }, { status: 400 })
  const sb = createServiceClient()
  const { error } = await sb.from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
