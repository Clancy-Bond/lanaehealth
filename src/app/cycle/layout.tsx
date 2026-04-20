/**
 * Cycle tab layout.
 *
 * Importing the home-widgets side-effect here registers the three cycle
 * widgets into the HOME_WIDGETS registry whenever anything under /cycle
 * renders. This is the registration contract defined in
 * docs/plans/2026-04-19-clone-prompts.md:
 *   "Register home widgets by calling registerWidget() from a side-effect
 *    file like src/lib/<tab>/home-widgets.ts that is imported once from
 *    src/app/<tab>/layout.tsx."
 *
 * Next.js runs the layout module at process boot when any route under
 * /cycle is first requested; registrations persist for the lifetime of
 * the server process.
 */
import '@/lib/cycle/home-widgets'

export default function CycleLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
