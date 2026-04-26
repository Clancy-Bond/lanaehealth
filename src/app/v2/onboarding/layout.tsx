/**
 * Onboarding wizard layout.
 *
 * The wizard renders bare (no bottom tab bar) so the user can focus
 * on a single decision per screen. The /v2 layout's PrePaintThemeScript
 * still wraps everything via app/v2/layout.tsx so dark/light theme
 * preferences persist into the wizard.
 *
 * No middleware redirect logic here; the entry page (page.tsx) does
 * the "is this user already onboarded?" check and bounces them home
 * if so. The wizard is reachable via direct link as well, so users
 * who want to update their answers later can re-enter manually
 * (settings re-link is a follow-up task, not P0).
 */
import type { ReactNode } from 'react'

export const metadata = {
  title: 'Welcome to LanaeHealth',
}

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
