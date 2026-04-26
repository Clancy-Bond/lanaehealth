/**
 * GET /auth/callback
 *
 * OAuth callback for Apple + Google sign-in. Supabase redirects the
 * browser here after the provider's consent flow with `?code=…`.
 * We exchange the code for a session, then route the user:
 *
 *   - to /v2/onboarding/1 if they have no health_profile rows
 *     (new account or first sign-in via OAuth)
 *   - to ?redirectTo if it's a safe path under /v2 or /
 *   - to /v2 otherwise
 *
 * Errors land back on /v2/login with an `error` query param so the
 * login UI can show a quiet message.
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

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const errorDescription = url.searchParams.get('error_description')
  const redirectTo = safeRedirect(url.searchParams.get('redirectTo'))

  if (errorDescription) {
    const back = new URL('/v2/login', url.origin)
    back.searchParams.set('error', errorDescription)
    return NextResponse.redirect(back)
  }
  if (!code) {
    const back = new URL('/v2/login', url.origin)
    back.searchParams.set('error', 'No code returned from provider.')
    return NextResponse.redirect(back)
  }

  const supabase = await getSupabaseServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    const back = new URL('/v2/login', url.origin)
    back.searchParams.set('error', `Sign-in did not finish: ${error.message}`)
    return NextResponse.redirect(back)
  }

  // Decide where to send the user. If they have a row in
  // health_profile they are onboarded. New OAuth accounts go to
  // the onboarding wizard.
  const { data: userResp } = await supabase.auth.getUser()
  const user = userResp?.user
  if (!user) {
    return NextResponse.redirect(new URL('/v2/login', url.origin))
  }

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
    // If the lookup fails, default to /v2 rather than blocking.
    target = redirectTo ?? '/v2'
  }

  return NextResponse.redirect(new URL(target, url.origin))
}
