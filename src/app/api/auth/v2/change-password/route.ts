/**
 * POST /api/auth/v2/change-password
 *
 * In-app password change for an already signed-in user. Body:
 *
 *   { currentPassword: string, newPassword: string }
 *
 * Two checks before mutating the credential:
 *
 *   1. The request must come from a Supabase Auth session
 *      (requireUser). Anonymous callers get 401.
 *
 *   2. We re-verify the current password by attempting a fresh
 *      `signInWithPassword` against the same email. This blocks
 *      session-hijack attacks where an attacker who steals an
 *      active cookie could otherwise lock the real owner out.
 *
 * On success we call `auth.updateUser({ password })` on the
 * server-bound client so the new password is reflected
 * immediately in this session AND any future sign-in.
 *
 * We deliberately avoid signing out other devices here. The
 * Supabase client refreshes existing sessions transparently when
 * the password rotates; tooling that wants to terminate sessions
 * elsewhere should call `auth.signOut({ scope: 'others' })` from
 * a separate flow once we surface that toggle.
 *
 * Voice rule: error messages stay short and human. Generic
 * "Could not update password" hides the underlying cause from
 * UI surfaces; the underlying error is logged server-side via
 * console.warn for the operator.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireUser, UnauthenticatedError } from '@/lib/auth/get-user'
import { getSupabaseServerClient } from '@/lib/auth/supabase-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface ChangePasswordBody {
  currentPassword?: unknown
  newPassword?: unknown
}

/**
 * Minimum new-password rules. Mirror the signup endpoint so the
 * two surfaces never disagree on what counts as a valid password.
 */
function validateNewPassword(pw: string): string | null {
  if (pw.length < 8) return 'New password must be at least 8 characters.'
  if (pw.length > 128) return 'New password is too long.'
  return null
}

export async function POST(req: Request) {
  // Step 1: ensure the request carries a valid session.
  let user
  try {
    user = await requireUser()
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }

  // Step 2: parse + validate the body.
  let body: ChangePasswordBody
  try {
    body = (await req.json()) as ChangePasswordBody
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : ''
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''
  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: 'currentPassword and newPassword are required' },
      { status: 400 },
    )
  }
  const validationError = validateNewPassword(newPassword)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }
  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: 'New password must be different from current password.' },
      { status: 400 },
    )
  }

  const email = user.email
  if (!email) {
    // Sign-in providers like Apple Hide My Email return null. Those
    // users do not have a knowable password to verify against, so we
    // refuse the change here and direct them to the forgot-password
    // flow which works via the email-on-file.
    return NextResponse.json(
      { error: 'This account uses single sign-on. Use Forgot password instead.' },
      { status: 400 },
    )
  }

  // Step 3: verify the current password with a *throwaway* client so
  // we do not perturb the request's session cookie. signInWithPassword
  // on the server-bound client would write a fresh access_token and
  // bump the cookie timestamps, which is unnecessary noise.
  const verifierUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const verifierKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!verifierUrl || !verifierKey) {
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
  const verifier = createClient(verifierUrl, verifierKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const verify = await verifier.auth.signInWithPassword({ email, password: currentPassword })
  if (verify.error || !verify.data.user) {
    return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 })
  }

  // Step 4: rotate the password on the user's actual session client
  // so the cookie stays current.
  const supabase = await getSupabaseServerClient()
  const update = await supabase.auth.updateUser({ password: newPassword })
  if (update.error) {
    console.warn('[change-password] updateUser failed:', update.error.message)
    return NextResponse.json({ error: 'Could not update password.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
