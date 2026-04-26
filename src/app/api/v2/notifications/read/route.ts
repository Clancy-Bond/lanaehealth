/**
 * Mark a notification_log entry read so the in-app toast hides next poll.
 */
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface ReadBody {
  ids: string[]
}

export async function POST(req: Request) {
  let body: ReadBody
  try {
    body = (await req.json()) as ReadBody
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: 'ids required' }, { status: 400 })
  }

  const sb = createServiceClient()
  const { error, count } = await sb
    .from('notification_log')
    .update({ read_at: new Date().toISOString() }, { count: 'exact' })
    .in('id', body.ids)
    .is('read_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, marked: count ?? 0 })
}
