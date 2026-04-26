/**
 * GET /api/v2/onboarding/skip
 *
 * Lightweight redirect handler so the wizard's "Skip for now" link can
 * be a plain anchor (no client-side fetch). Marks the user as onboarded
 * with the skipped flag and bounces them home. Unauthenticated visits
 * land on /v2/login so they re-enter the funnel.
 */
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/get-user'
import { markOnboarded } from '@/lib/v2/onboarding/state'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    const url = new URL('/v2/login', req.url)
    return NextResponse.redirect(url)
  }

  await markOnboarded(user.id, { skipped: true })
  const home = new URL('/v2', req.url)
  return NextResponse.redirect(home)
}
