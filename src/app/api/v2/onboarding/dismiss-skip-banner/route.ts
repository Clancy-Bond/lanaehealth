/**
 * POST /api/v2/onboarding/dismiss-skip-banner
 *
 * Permanently dismisses the home banner that nudges users who skipped
 * onboarding to finish setup. Sets skipped_dismissed=true on the
 * existing onboarding flag so the banner stays gone forever.
 *
 * Requires an authenticated user; the user_id is read from the
 * session, never from the request body. Idempotent.
 */
import { NextResponse } from 'next/server'
import { requireUser, UnauthenticatedError } from '@/lib/auth/get-user'
import { dismissSkipBanner } from '@/lib/v2/onboarding/state'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST() {
  let user
  try {
    user = await requireUser()
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }

  const result = await dismissSkipBanner(user.id)
  if (!result.ok) {
    return NextResponse.json({ error: 'save failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
