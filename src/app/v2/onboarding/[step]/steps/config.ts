/**
 * Wizard configuration: number of steps and metadata per step.
 *
 * Adding a step = bump TOTAL_STEPS and add an entry to STEP_TITLES.
 * The dynamic [step] route picks up the new step automatically.
 */
export const TOTAL_STEPS = 7

export type StepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7

export const STEP_TITLES: Record<StepNumber, { title: string; subtitle: string }> = {
  1: {
    title: 'Welcome',
    subtitle: "Here's what we'll set up together so the app actually knows you.",
  },
  2: {
    title: 'About you',
    subtitle: 'A few basics so cycle, sleep, and food math work right.',
  },
  3: {
    title: 'Conditions you live with',
    subtitle: 'Pick what applies. The AI tailors everything to this.',
  },
  4: {
    title: 'Medications and allergies',
    subtitle: 'Quick to add, easy to update later.',
  },
  5: {
    title: 'Connect your Oura ring',
    subtitle: 'Optional. We auto-import sleep, BBT, HRV, and activity if you wear one.',
  },
  6: {
    title: 'Insurance plan',
    subtitle: 'Optional. Lets the AI tailor advice to your carrier.',
  },
  7: {
    title: "You're set up",
    subtitle: "Here's what to try first.",
  },
}
