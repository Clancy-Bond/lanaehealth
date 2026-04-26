/**
 * /v2/onboarding/[step]
 *
 * Wizard router. Each step is a small client component composed
 * inside OnboardingShell. The outer page is a server component so we
 * can validate the step number, identify the user, and pre-fill any
 * partial data they've already entered (e.g. they bounced and came
 * back).
 */
import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/get-user'
import { isOnboarded } from '@/lib/v2/onboarding/state'
import { TOTAL_STEPS, type StepNumber } from './steps/config'
import StepRouter from './steps/StepRouter'
import { loadOnboardingDraft } from './steps/load-draft'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ step: string }>
}

export default async function OnboardingStepPage({ params }: PageProps) {
  const { step: stepStr } = await params
  const step = Number(stepStr)
  if (!Number.isInteger(step) || step < 1 || step > TOTAL_STEPS) {
    notFound()
  }

  const user = await getCurrentUser()

  // No session and middleware auth is enabled: bounce to login. The
  // returnTo carries the step so the user lands back where they were.
  // When middleware auth is disabled (dev / E2E preview) we still
  // render the wizard so the layout is testable; saves just no-op
  // because the API route enforces auth on its own.
  if (!user && process.env.LANAE_REQUIRE_AUTH !== 'false') {
    redirect('/v2/login?returnTo=/v2/onboarding/' + step)
  }

  // Returning users who already finished should not be funneled back.
  if (user && (await isOnboarded(user.id))) {
    redirect('/v2')
  }

  const draft = user ? await loadOnboardingDraft(user.id) : EMPTY_DRAFT

  return (
    <StepRouter
      step={step as StepNumber}
      totalSteps={TOTAL_STEPS}
      firstName={draft.personal?.full_name?.split(' ')[0] ?? ''}
      draft={draft}
      userEmail={user?.email ?? ''}
    />
  )
}

const EMPTY_DRAFT = {
  personal: null,
  conditions: [],
  medications: [],
  allergies: [],
  insurance: null,
}
