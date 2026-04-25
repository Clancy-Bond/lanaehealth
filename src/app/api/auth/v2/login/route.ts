/**
 * POST /api/auth/v2/login
 *
 * Supabase Auth email + password sign-in. Body:
 *   { email: string, password: string }
 *
 * On success the SSR Supabase client writes the session cookie
 * to the response automatically. Returns 200 with the user id.
 * On failure returns 401.
 */
import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/auth/supabase-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface LoginBody {
  email?: unknown
  password?: unknown
}

export async function POST(req: Request) {
  let body: LoginBody
  try {
    body = (await req.json()) as LoginBody
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!email || !password) {
    return NextResponse.json({ error: 'email and password required' }, { status: 400 })
  }

  const supabase = await getSupabaseServerClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return NextResponse.json({ error: 'invalid credentials' }, { status: 401 })
  }
  if (!data.user) {
    return NextResponse.json({ error: 'no user returned' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, userId: data.user.id, email: data.user.email })
}
