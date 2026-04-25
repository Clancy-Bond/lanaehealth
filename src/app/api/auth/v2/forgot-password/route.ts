/**
 * POST /api/auth/v2/forgot-password
 *
 * Trigger a password reset email. Body:
 *   { email: string }
 *
 * Always returns 200 to avoid leaking which addresses are
 * registered. The Supabase client only logs failures
 * server-side.
 */
import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/auth/supabase-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface ForgotBody {
  email?: unknown
}

export async function POST(req: Request) {
  let body: ForgotBody
  try {
    body = (await req.json()) as ForgotBody
  } catch {
    return NextResponse.json({ ok: true }) // do not leak parse errors here
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email) return NextResponse.json({ ok: true })

  const supabase = await getSupabaseServerClient()
  const redirectBase = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3005'
  await supabase.auth
    .resetPasswordForEmail(email, {
      redirectTo: `${redirectBase}/v2/login?reset=1`,
    })
    .catch(() => {
      // Swallowed by design (do not leak existence of accounts).
    })

  return NextResponse.json({ ok: true })
}
