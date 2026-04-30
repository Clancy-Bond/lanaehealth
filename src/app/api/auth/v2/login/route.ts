/**
 * POST /api/auth/v2/login
 *
 * Supabase Auth email + password sign-in. Body:
 *   { email: string, password: string }
 *
 * On success the SSR Supabase client writes the session cookie
 * to the response automatically. Returns 200 with the user id.
 *
 * On failure, returns a stable error code (string in `error`) so
 * the client can map it to NC-voice copy without depending on the
 * raw Supabase message:
 *
 *   - "invalid credentials" (401) -- wrong email or password
 *   - "email_not_confirmed" (401) -- account exists but email is unverified
 *   - "user_banned" (401)         -- account locked / disabled
 *   - "too_many_requests" (429)   -- Supabase rate limited the attempt
 *   - "mfa_required" (401)        -- Supabase issued a partial session that
 *                                    needs MFA, which we do not yet handle
 *   - "email and password required" (400)
 *   - "invalid json" (400)
 *   - "no user returned" (500)    -- unexpected, treated as server bug
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
    // Supabase JS exposes both `code` (newer) and `name` (older). We
    // also fall back to message substring matching because Supabase
    // has been known to change codes between versions.
    const code = (error as { code?: string }).code ?? ''
    const status = (error as { status?: number }).status ?? 401
    const lower = error.message.toLowerCase()

    if (status === 429 || code === 'over_request_rate_limit' || lower.includes('rate limit')) {
      return NextResponse.json({ error: 'too_many_requests' }, { status: 429 })
    }
    if (code === 'email_not_confirmed' || lower.includes('email not confirmed')) {
      return NextResponse.json({ error: 'email_not_confirmed' }, { status: 401 })
    }
    if (code === 'user_banned' || lower.includes('banned') || lower.includes('disabled')) {
      return NextResponse.json({ error: 'user_banned' }, { status: 401 })
    }
    return NextResponse.json({ error: 'invalid credentials' }, { status: 401 })
  }
  if (!data.user) {
    return NextResponse.json({ error: 'no user returned' }, { status: 500 })
  }

  // Defense-in-depth: if Supabase ever issues a partial sign-in that
  // requires an MFA challenge, `data.session` is null even though
  // `data.user` is set. We do not yet implement an MFA challenge UI,
  // so refuse the sign-in rather than route the user into a broken
  // state. Surfaced as a distinct code so the form can explain.
  if (!data.session) {
    return NextResponse.json({ error: 'mfa_required' }, { status: 401 })
  }

  return NextResponse.json({ ok: true, userId: data.user.id, email: data.user.email })
}
