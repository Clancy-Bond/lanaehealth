'use client'

/**
 * Client-side router that picks the right step component.
 *
 * Each step is its own client component; we keep them in separate
 * files so the bundle stays small and the per-step state stays
 * encapsulated. The dynamic [step] page passes us the parsed step
 * number plus any pre-existing draft.
 */
import StepWelcome from './StepWelcome'
import StepAbout from './StepAbout'
import StepConditions from './StepConditions'
import StepMedications from './StepMedications'
import StepOura from './StepOura'
import StepInsurance from './StepInsurance'
import StepDone from './StepDone'
import type { OnboardingDraft } from './load-draft'
import type { StepNumber } from './config'

interface StepRouterProps {
  step: StepNumber
  totalSteps: number
  firstName: string
  draft: OnboardingDraft
  userEmail: string
}

export default function StepRouter({
  step,
  totalSteps,
  firstName,
  draft,
  userEmail,
}: StepRouterProps) {
  const common = { step, totalSteps }
  switch (step) {
    case 1:
      return <StepWelcome {...common} firstName={firstName || displayNameFromEmail(userEmail)} />
    case 2:
      return <StepAbout {...common} initial={draft.personal} />
    case 3:
      return <StepConditions {...common} initial={draft.conditions} />
    case 4:
      return (
        <StepMedications
          {...common}
          initialMedications={draft.medications}
          initialAllergies={draft.allergies}
        />
      )
    case 5:
      return <StepOura {...common} />
    case 6:
      return <StepInsurance {...common} initial={draft.insurance} />
    case 7:
      return <StepDone {...common} firstName={firstName || displayNameFromEmail(userEmail)} />
  }
}

function displayNameFromEmail(email: string): string {
  if (!email) return 'there'
  const local = email.split('@')[0]
  if (!local) return 'there'
  return local.charAt(0).toUpperCase() + local.slice(1)
}
