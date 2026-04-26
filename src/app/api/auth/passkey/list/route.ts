/**
 * GET /api/auth/passkey/list
 * DELETE /api/auth/passkey/list?id=<credential row id>
 *
 * Lists or removes the passkeys registered to the signed-in user.
 * The settings UI uses these to show "Face ID enabled" + a remove
 * button.
 */
import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/auth/supabase-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const supabase = await getSupabaseServerClient()
  const { data: userResp } = await supabase.auth.getUser()
  const user = userResp?.user
  if (!user) return NextResponse.json({ error: 'not signed in' }, { status: 401 })

  const { data, error } = await supabase
    .from('passkey_credentials')
    .select('id, device_name, created_at, last_used_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, passkeys: data ?? [] })
}

export async function DELETE(req: Request) {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const supabase = await getSupabaseServerClient()
  const { data: userResp } = await supabase.auth.getUser()
  const user = userResp?.user
  if (!user) return NextResponse.json({ error: 'not signed in' }, { status: 401 })

  const { error } = await supabase
    .from('passkey_credentials')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
