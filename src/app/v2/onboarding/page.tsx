/**
 * /v2/onboarding (index)
 *
 * Bounces the user into step 1 of the wizard. Already-onboarded users
 * land on the home page instead so deep-links into /v2/onboarding do
 * not trap returning users in the wizard.
 */
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/get-user'
import { isOnboarded } from '@/lib/v2/onboarding/state'

export const dynamic = 'force-dynamic'

export default async function OnboardingIndexPage() {
  const user = await getCurrentUser()
  // Already-onboarded users skip the wizard. Unauthenticated visits
  // (E2E / preview with middleware auth disabled) still get routed
  // into step 1 so the wizard structure is reachable without a
  // fixture account.
  if (user && (await isOnboarded(user.id))) {
    redirect('/v2')
  }
  redirect('/v2/onboarding/1')
}
