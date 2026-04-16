/**
 * Onboarding Page
 *
 * Server component that checks if user has completed onboarding.
 * If completed, redirects to home. Otherwise, renders the wizard.
 */

import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import ArchetypeWizard from '@/components/onboarding/ArchetypeWizard'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const supabase = createServiceClient()

  // Check both onboarding tables (legacy and new)
  const { data: legacyOnboarding } = await supabase
    .from('user_onboarding')
    .select('completed_at')
    .limit(1)
    .maybeSingle()

  const { data: newPrefs } = await supabase
    .from('user_preferences')
    .select('onboarding_completed_at')
    .limit(1)
    .maybeSingle()

  if (legacyOnboarding?.completed_at || newPrefs?.onboarding_completed_at) {
    redirect('/')
  }

  return <ArchetypeWizard />
}
