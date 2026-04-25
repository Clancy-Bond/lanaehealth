'use client'

/*
 * CycleTourLauncher
 *
 * Mounts CoachmarkTour for the /v2/cycle screen and persists
 * progress via /api/v2/cycle/tutorial. Auto-starts on first visit
 * (when no progress exists, completed = false, dismissed = false).
 *
 * Skipping or finishing closes the tour and marks it accordingly.
 * /v2/settings exposes a "Replay tour" control that POSTs
 * { lastStep: 0, dismissed: false } to start it again.
 */
import { useEffect, useState } from 'react'
import CoachmarkTour, { CYCLE_TOUR_STEPS } from '@/v2/components/CoachmarkTour'

export interface CycleTourLauncherProps {
  initialStep?: number
  completed?: boolean
  dismissed?: boolean
  /**
   * When true, the tour starts on mount. The cycle page should pass
   * (!completed && !dismissed) so first-time users see it without
   * blocking the page render.
   */
  autoStartForFirstVisit?: boolean
}

export default function CycleTourLauncher({
  initialStep = 0,
  completed = false,
  dismissed = false,
  autoStartForFirstVisit = false,
}: CycleTourLauncherProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(initialStep)

  useEffect(() => {
    if (!autoStartForFirstVisit || completed || dismissed) return
    // Defer one tick so the page paint completes before the scrim
    // appears; avoids the spotlight flickering against a blank page.
    const t = window.setTimeout(() => setOpen(true), 250)
    return () => window.clearTimeout(t)
  }, [autoStartForFirstVisit, completed, dismissed])

  const persist = async (patch: Record<string, unknown>) => {
    try {
      await fetch('/api/v2/cycle/tutorial', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      })
    } catch {
      // Best-effort. The tour still works in the local session.
    }
  }

  return (
    <CoachmarkTour
      steps={CYCLE_TOUR_STEPS}
      open={open}
      initialStep={step}
      onAdvance={(next) => {
        setStep(next)
        void persist({ lastStep: next })
      }}
      onClose={(finished, lastStep) => {
        setOpen(false)
        void persist({
          lastStep,
          completed: finished,
          dismissed: !finished,
        })
      }}
    />
  )
}
