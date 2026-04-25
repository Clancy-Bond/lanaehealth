/**
 * POST /api/auth/v2/signup
 *
 * Supabase Auth email + password signup. Body:
 *   { email: string, password: string }
 *
 * Returns 200 on success. The Supabase session cookie is set
 * automatically by the SSR client when email confirmation is
 * disabled. When email confirmation is required, the response
 * carries `requiresEmailConfirmation: true` and the caller
 * should display a "check your inbox" state.
 *
 * Multi-user productization step 1. Distinct from the legacy
 * /api/auth/login (shared-secret) flow which stays in place
 * for the iOS Shortcut and cron invocations.
 */
import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/auth/supabase-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface SignupBody {
  email?: unknown
  password?: unknown
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function POST(req: Request) {
  let body: SignupBody
  try {
    body = (await req.json()) as SignupBody
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'invalid email' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: 'password must be at least 8 characters' },
      { status: 400 },
    )
  }

  const supabase = await getSupabaseServerClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Supabase will send the verification email if Confirm Email
      // is enabled in the project Auth settings. The redirect lands
      // back in v2 once the user clicks the link.
      emailRedirectTo:
        (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3005') + '/v2',
    },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const requiresEmailConfirmation = !data.session
  return NextResponse.json({ ok: true, requiresEmailConfirmation })
}
