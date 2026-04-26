/**
 * Read + update notification category preferences for a subscription.
 *
 * GET ?endpoint=...   -> { enabledTypes: string[], enabled: boolean }
 * PATCH               -> body { endpoint, enabledTypes }
 *
 * Used by NotificationsCard in /v2/settings to show the current state
 * of the checkboxes without re-subscribing.
 */
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { isValidCategory } from '@/lib/notifications/categories'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const endpoint = url.searchParams.get('endpoint')
  if (!endpoint) return NextResponse.json({ error: 'endpoint required' }, { status: 400 })

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('push_subscriptions')
    .select('enabled, enabled_types')
    .eq('endpoint', endpoint)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ enabled: false, enabledTypes: [] })
  return NextResponse.json({ enabled: data.enabled, enabledTypes: data.enabled_types ?? [] })
}

interface PatchBody {
  endpoint: string
  enabledTypes: string[]
}

export async function PATCH(req: Request) {
  let body: PatchBody
  try {
    body = (await req.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  if (!body.endpoint) return NextResponse.json({ error: 'endpoint required' }, { status: 400 })

  const enabledTypes = (body.enabledTypes ?? []).filter(isValidCategory)
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('push_subscriptions')
    .update({ enabled_types: enabledTypes, updated_at: new Date().toISOString() })
    .eq('endpoint', body.endpoint)
    .select('id, enabled_types')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'subscription not found' }, { status: 404 })
  return NextResponse.json({ ok: true, enabledTypes: data.enabled_types })
}
