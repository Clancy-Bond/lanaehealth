/**
 * /v2/onboarding (index)
 *
 * Bounces the user into step 1 of the wizard. Already-onboarded users
 * land on the home page instead so deep-links into /v2/onboarding do
 * not trap returning users in the wizard.
 *
 * Exception: when ?revise=true is present, returning users are
 * intentionally routed back into the wizard so they can revise
 * their answers. The revise flag is forwarded to step 1 so each
 * step keeps the pre-fill behavior.
 */
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/get-user'
import { isOnboarded } from '@/lib/v2/onboarding/state'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ revise?: string }>
}

export default async function OnboardingIndexPage({ searchParams }: PageProps) {
  const params = await searchParams
  const revise = params.revise === 'true'
  const user = await getCurrentUser()
  // Already-onboarded users skip the wizard unless ?revise=true,
  // which the settings re-link uses to send returning users back
  // through with their existing answers pre-filled. Unauthenticated
  // visits (E2E / preview with middleware auth disabled) still get
  // routed into step 1 so the wizard structure is reachable without
  // a fixture account.
  if (!revise && user && (await isOnboarded(user.id))) {
    redirect('/v2')
  }
  redirect(revise ? '/v2/onboarding/1?revise=true' : '/v2/onboarding/1')
}
