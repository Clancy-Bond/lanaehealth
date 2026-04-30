/**
 * GET /auth/callback
 *
 * OAuth callback for Apple + Google sign-in. Supabase redirects the
 * browser here after the provider's consent flow with `?code=...`.
 * We exchange the code for a session, then route the user:
 *
 *   - to /v2/onboarding/1 if they have no health_profile rows
 *     (new account or first sign-in via OAuth)
 *   - to ?redirectTo if it is a safe path under /v2 or /
 *   - to /v2 otherwise
 *
 * Every failure mode redirects back to /v2/login with an `error`
 * query param so the login UI can show a quiet message. We never
 * serve a 5xx from this route. exchangeCodeForSession() is wrapped
 * in try/catch because Supabase JS throws (rather than returning
 * `{ error }`) when the PKCE code_verifier cookie is missing -- a
 * common failure mode on iOS Safari with Intelligent Tracking
 * Prevention, or when the user reloads the callback URL.
 */
import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/auth/supabase-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function safeRedirect(value: string | null): string | null {
  if (!value) return null
  if (!value.startsWith('/')) return null
  if (value.startsWith('//')) return null
  return value
}

function backToLogin(origin: string, message: string): NextResponse {
  const back = new URL('/v2/login', origin)
  back.searchParams.set('error', message)
  return NextResponse.redirect(back)
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const errorDescription = url.searchParams.get('error_description')
  const redirectTo = safeRedirect(url.searchParams.get('redirectTo'))

  if (errorDescription) {
    return backToLogin(url.origin, errorDescription)
  }
  if (!code) {
    return backToLogin(url.origin, 'No code returned from provider.')
  }

  // Wrap the entire Supabase interaction. Construction can throw
  // (missing env), exchangeCodeForSession can throw (missing PKCE
  // verifier cookie, expired code), and getUser can throw on
  // network or token verification failures. Any of these should
  // land the user back on /v2/login with a readable message rather
  // than a 500 page.
  try {
    const supabase = await getSupabaseServerClient()

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      return backToLogin(url.origin, `Sign-in did not finish: ${exchangeError.message}`)
    }

    const { data: userResp } = await supabase.auth.getUser()
    const user = userResp?.user
    if (!user) {
      return backToLogin(
        url.origin,
        'We could not start your session. Please sign in again.',
      )
    }

    // Decide where to send the user. If they have a row in
    // health_profile they are onboarded. New OAuth accounts go to
    // the onboarding wizard.
    let target = redirectTo ?? '/v2'
    try {
      const { data: profileRows } = await supabase
        .from('health_profile')
        .select('section')
        .eq('user_id', user.id)
        .limit(1)
      const isOnboarded = Array.isArray(profileRows) && profileRows.length > 0
      if (!isOnboarded && !redirectTo) {
        target = '/v2/onboarding/1'
      }
    } catch {
      // Profile lookup is non-blocking; default to /v2 on failure.
      target = redirectTo ?? '/v2'
    }

    return NextResponse.redirect(new URL(target, url.origin))
  } catch (err) {
    const message =
      err instanceof Error && err.message ? err.message : 'Unknown error.'
    return backToLogin(url.origin, `Sign-in did not finish: ${message}`)
  }
}
