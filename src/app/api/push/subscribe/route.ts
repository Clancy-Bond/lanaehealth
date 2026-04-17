import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface SubscribePayload {
  endpoint: string
  keys: { p256dh: string; auth: string }
  morningTime?: string
  eveningTime?: string
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

  const sb = createServiceClient()
  const userAgent = req.headers.get('user-agent') ?? null

  const { data, error } = await sb
    .from('push_subscriptions')
    .upsert(
      {
        endpoint: body.endpoint,
        keys: body.keys,
        user_agent: userAgent,
        morning_time: body.morningTime ?? '08:00',
        evening_time: body.eveningTime ?? '21:00',
        timezone: body.timezone ?? 'Pacific/Honolulu',
        enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
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
