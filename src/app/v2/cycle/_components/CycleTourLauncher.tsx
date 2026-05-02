'use client'

/*
 * CycleTourLauncher
 *
 * Mounts CoachmarkTour for the /v2/cycle screen and persists progress
 * via /api/v2/cycle/tutorial. Auto-starts on first visit (when no
 * progress exists, completed = false, dismissed = false). Skipping or
 * finishing closes the tour and marks it accordingly. /v2/settings
 * exposes a "Replay tour" control that POSTs { lastStep: 0, dismissed:
 * false } to start it again.
 *
 * THE LOOP BUG (fixed 2026-05-02):
 *   Before this fix the fire decision depended 100% on server-rendered
 *   `completed` / `dismissed` props. If the PATCH ever failed (no auth
 *   in dev, network glitch, RLS, schema mismatch, etc.) the launcher
 *   silently swallowed the error and the tour fired again on the next
 *   visit, even after the user clearly skipped it. Confirmed in dev
 *   with `LANAE_REQUIRE_AUTH=false`: page renders without auth but the
 *   PATCH `requireUser()` throws → 401 → catch swallows → server state
 *   stays at default → tour relaunches forever.
 *
 *   The fix mirrors NC's actual behavior: the tour is purely UX, so
 *   the fire decision lives client-side. localStorage holds an
 *   immediate dismissal record (`v2-cycle-tour-state`); the server
 *   PATCH stays as the cross-device source of truth but its failure
 *   no longer relaunches the tour. Any of the three signals
 *   (server completed, server dismissed, localStorage flag) keeps the
 *   tour closed.
 *
 *   The Replay control on /v2/settings clears the localStorage flag
 *   alongside the PATCH that resets server state.
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

/**
 * localStorage key for the client-side dismissal record. Versioned so
 * a future schema change can opt all users back in cleanly.
 */
const TOUR_STATE_KEY = 'v2-cycle-tour-state-v1'

interface LocalTourState {
  /** True once the user reached the final Got-it. */
  completed: boolean
  /** True once the user tapped Skip at any step. */
  dismissed: boolean
  /** Last step the user saw, used as initialStep on Replay. */
  lastStep: number
  /** ISO timestamp of last update. */
  updatedAt: string
}

function readLocalTourState(): LocalTourState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(TOUR_STATE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LocalTourState>
    if (typeof parsed !== 'object' || parsed == null) return null
    return {
      completed: parsed.completed === true,
      dismissed: parsed.dismissed === true,
      lastStep:
        typeof parsed.lastStep === 'number' && Number.isFinite(parsed.lastStep)
          ? parsed.lastStep
          : 0,
      updatedAt:
        typeof parsed.updatedAt === 'string'
          ? parsed.updatedAt
          : new Date(0).toISOString(),
    }
  } catch {
    return null
  }
}

function writeLocalTourState(next: Partial<LocalTourState>): void {
  if (typeof window === 'undefined') return
  try {
    const current = readLocalTourState() ?? {
      completed: false,
      dismissed: false,
      lastStep: 0,
      updatedAt: new Date(0).toISOString(),
    }
    const merged: LocalTourState = {
      completed: next.completed ?? current.completed,
      dismissed: next.dismissed ?? current.dismissed,
      lastStep:
        typeof next.lastStep === 'number' && Number.isFinite(next.lastStep)
          ? next.lastStep
          : current.lastStep,
      updatedAt: new Date().toISOString(),
    }
    window.localStorage.setItem(TOUR_STATE_KEY, JSON.stringify(merged))
  } catch {
    // Quota exhausted, private browsing, etc. The server PATCH still
    // tries; if both fail the tour will fire again on next visit but
    // that is the existing fallback rather than a regression.
  }
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
    if (!autoStartForFirstVisit) return
    // Server says open or no decision yet. Layer the local state on
    // top: if any of (server completed, server dismissed, local
    // completed, local dismissed) is true, do not fire. This is the
    // critical line that closes the loop bug: any persistence
    // failure on the server side cannot relaunch the tour because
    // localStorage carries the user's intent.
    if (completed || dismissed) return
    const local = readLocalTourState()
    if (local && (local.completed || local.dismissed)) return
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
      // Best-effort. localStorage already holds the user's intent so
      // a network or auth failure here cannot relaunch the tour.
    }
  }

  return (
    <CoachmarkTour
      steps={CYCLE_TOUR_STEPS}
      open={open}
      initialStep={step}
      onAdvance={(next) => {
        setStep(next)
        // Write client-side first (synchronous, never fails) so
        // refreshing mid-tour resumes at the right step even if the
        // server has not been told yet.
        writeLocalTourState({ lastStep: next })
        void persist({ lastStep: next })
      }}
      onClose={(finished, lastStep) => {
        setOpen(false)
        // Write client-side dismissal/completion BEFORE the network
        // call. Even if the PATCH 401s, fails RLS, or never resolves,
        // the next visit reads localStorage and stays closed.
        writeLocalTourState({
          lastStep,
          completed: finished,
          dismissed: !finished,
        })
        void persist({
          lastStep,
          completed: finished,
          dismissed: !finished,
        })
      }}
    />
  )
}

/**
 * Public helper for the /v2/settings "Replay tour" control. Clears
 * the local dismissal record so the launcher's effect can fire the
 * tour again on the next /v2/cycle visit. Pair with the existing
 * server PATCH that resets `completed`/`dismissed` to false.
 */
export function clearLocalTourState(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(TOUR_STATE_KEY)
  } catch {
    // ignore
  }
}
