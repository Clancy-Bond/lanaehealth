'use client'

/*
 * CoachmarkTour
 *
 * 7-step in-app onboarding tour mirroring NC's coachmark overlay
 * (frame_0255 through frame_0313, audit Section 5.4). Renders a
 * dimmed scrim, a soft spotlight cut-out around the target, the
 * step copy with a Next / Skip control, and a step counter.
 *
 * Coachmark targets opt in via `data-tour-step="<step-id>"` on the
 * existing component. The tour reads `getBoundingClientRect()` to
 * draw the spotlight; if the target is missing, it falls back to a
 * centered card without a spotlight so the tour still progresses.
 *
 * Progress is persisted via `/api/v2/cycle/tutorial`. The tour
 * resumes at the last unfinished step on next visit, and can be
 * replayed from /v2/settings.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

export interface CoachmarkStep {
  id: string
  /**
   * CSS-selector or data-tour-step token to anchor the spotlight on.
   * Pass `null` for the final tip (no anchor needed).
   */
  target: string | null
  title: string
  body: string
}

export interface CoachmarkTourProps {
  steps: CoachmarkStep[]
  /** When true, the tour mounts and starts at step 0. */
  open: boolean
  /** Initial step index when resuming. */
  initialStep?: number
  /** Called after the user advances; persist progress here. */
  onAdvance?: (nextStep: number) => void
  /** Called when the user dismisses (Skip / X / completes). */
  onClose?: (finished: boolean, lastStep: number) => void
}

/**
 * Render the coachmark overlay. The tour is fully accessible: the
 * scrim has role="dialog" and aria-modal so screen readers focus
 * the active coachmark.
 */
export default function CoachmarkTour({
  steps,
  open,
  initialStep = 0,
  onAdvance,
  onClose,
}: CoachmarkTourProps) {
  const [step, setStep] = useState(clampStep(initialStep, steps.length))
  const [rect, setRect] = useState<DOMRect | null>(null)

  // Reset internal step when open transitions or initialStep changes.
  useEffect(() => {
    if (open) setStep(clampStep(initialStep, steps.length))
  }, [open, initialStep, steps.length])

  const current = steps[step] ?? null

  // Resolve and track the target rect. Re-measure on resize and a
  // periodic tick so the spotlight follows scroll without a heavy
  // ResizeObserver dependency on every coachmark.
  useEffect(() => {
    if (!open || !current) return
    const measure = () => {
      if (current.target) {
        const sel = current.target.startsWith('[')
          ? current.target
          : `[data-tour-step="${current.target}"]`
        const el = document.querySelector(sel) as HTMLElement | null
        if (el) {
          const r = el.getBoundingClientRect()
          setRect(r)
          if (r.top < 0 || r.bottom > window.innerHeight) {
            el.scrollIntoView({ block: 'center', behavior: 'smooth' })
          }
        } else {
          setRect(null)
        }
      } else {
        setRect(null)
      }
    }
    measure()
    const onResize = () => measure()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    const tick = window.setInterval(measure, 250)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
      window.clearInterval(tick)
    }
  }, [open, current])

  const advance = useCallback(() => {
    if (!steps.length) return
    const next = step + 1
    if (next >= steps.length) {
      onClose?.(true, step)
      return
    }
    setStep(next)
    onAdvance?.(next)
  }, [step, steps.length, onAdvance, onClose])

  const skip = useCallback(() => {
    onClose?.(false, step)
  }, [step, onClose])

  if (!open || !current) return null

  const counter = `${step + 1} / ${steps.length}`

  return (
    <AnimatePresence>
      <motion.div
        key="coachmark-scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        role="dialog"
        aria-modal="true"
        aria-label={`Onboarding step ${counter}`}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 60,
          pointerEvents: 'auto',
        }}
      >
        <Spotlight rect={rect} />
        <CoachmarkCard
          step={current}
          counter={counter}
          rect={rect}
          onAdvance={advance}
          onSkip={skip}
          isLast={step + 1 === steps.length}
        />
      </motion.div>
    </AnimatePresence>
  )
}

function Spotlight({ rect }: { rect: DOMRect | null }) {
  if (!rect) {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(8, 8, 12, 0.72)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
        }}
      />
    )
  }
  const PAD = 8
  const x = Math.max(0, rect.left - PAD)
  const y = Math.max(0, rect.top - PAD)
  const w = rect.width + PAD * 2
  const h = rect.height + PAD * 2
  return (
    <div
      style={{
        position: 'absolute',
        top: y,
        left: x,
        width: w,
        height: h,
        borderRadius: 16,
        boxShadow:
          '0 0 0 9999px rgba(8, 8, 12, 0.72), 0 0 0 2px rgba(216, 168, 245, 0.45) inset',
        pointerEvents: 'none',
      }}
    />
  )
}

interface CardProps {
  step: CoachmarkStep
  counter: string
  rect: DOMRect | null
  onAdvance: () => void
  onSkip: () => void
  isLast: boolean
}

function CoachmarkCard({ step, counter, rect, onAdvance, onSkip, isLast }: CardProps) {
  /*
   * Position the card with numeric left/top instead of CSS
   * `transform: translate(-50%, ...)`. Framer Motion's
   * `animate={{ y: 0 }}` compiles to a CSS transform on the same
   * element and clobbers the translate, leaving the coachmark
   * card half off-screen on every viewport. Computing left in
   * pixels using window.innerWidth keeps the card inside the
   * viewport without depending on a transform we no longer own.
   */
  const position = useMemo(() => {
    if (typeof window === 'undefined') {
      return { top: 0, left: 0 }
    }
    const margin = 16
    const cardWidth = Math.min(window.innerWidth * 0.92, 360)
    const left = Math.max(margin, (window.innerWidth - cardWidth) / 2)
    if (!rect) {
      const top = Math.max(margin, (window.innerHeight - 220) / 2)
      return { top, left }
    }
    const cardHeight = 220
    const fitsBelow = rect.bottom + margin + cardHeight < window.innerHeight
    const top = fitsBelow
      ? rect.bottom + margin
      : Math.max(margin, rect.top - cardHeight - margin)
    return { top, left }
  }, [rect])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        position: 'absolute',
        width: 'min(92vw, 360px)',
        background: 'var(--v2-bg-card)',
        color: 'var(--v2-text-primary)',
        borderRadius: 'var(--v2-radius-lg)',
        border: '1px solid var(--v2-border-subtle)',
        boxShadow: '0 12px 36px rgba(0,0,0,0.45)',
        padding: 'var(--v2-space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-3)',
        pointerEvents: 'auto',
        ...position,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--v2-space-2)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-muted)',
            fontWeight: 'var(--v2-weight-medium)',
            letterSpacing: 'var(--v2-tracking-wide)',
            textTransform: 'uppercase',
          }}
        >
          {counter}
        </span>
        <button
          type="button"
          onClick={onSkip}
          aria-label="Skip tour"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--v2-text-muted)',
            cursor: 'pointer',
            fontSize: 'var(--v2-text-sm)',
            padding: 'var(--v2-space-1) var(--v2-space-2)',
          }}
        >
          Skip
        </button>
      </div>
      <h3
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-lg)',
          fontWeight: 'var(--v2-weight-semibold)',
          lineHeight: 'var(--v2-leading-tight)',
        }}
      >
        {step.title}
      </h3>
      <p
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-sm)',
          lineHeight: 'var(--v2-leading-relaxed)',
          color: 'var(--v2-text-secondary)',
        }}
      >
        {step.body}
      </p>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: 'var(--v2-space-2)',
        }}
      >
        <button
          type="button"
          onClick={onAdvance}
          style={{
            background: 'var(--v2-text-primary)',
            color: 'var(--v2-bg-page)',
            border: 'none',
            borderRadius: 'var(--v2-radius-full)',
            padding: 'var(--v2-space-2) var(--v2-space-4)',
            fontSize: 'var(--v2-text-sm)',
            fontWeight: 'var(--v2-weight-semibold)',
            cursor: 'pointer',
            minHeight: 'var(--v2-touch-target-min)',
          }}
        >
          {isLast ? 'Got it' : 'Next'}
        </button>
      </div>
    </motion.div>
  )
}

/**
 * Clamp a step index into the valid range [0, total - 1]. Exported
 * so the state-machine logic is testable without rendering.
 */
export function clampStep(n: number, total: number): number {
  if (!Number.isFinite(n) || n < 0) return 0
  if (n >= total) return Math.max(0, total - 1)
  return Math.floor(n)
}

/**
 * Pure transition for advancing the tour. Returns the next state
 * and whether the tour finished. Extracted from the component so
 * the state machine can be tested without DOM/jest-dom.
 */
export type TourEvent =
  | { type: 'advance' }
  | { type: 'skip' }
  | { type: 'reset'; to?: number }
export interface TourState {
  step: number
  open: boolean
  finished: boolean
  dismissed: boolean
}

export function reduceTour(
  state: TourState,
  event: TourEvent,
  totalSteps: number,
): TourState {
  switch (event.type) {
    case 'advance': {
      const next = state.step + 1
      if (next >= totalSteps) {
        return { ...state, step: state.step, open: false, finished: true, dismissed: false }
      }
      return { ...state, step: next }
    }
    case 'skip':
      return { ...state, open: false, finished: false, dismissed: true }
    case 'reset':
      return {
        step: clampStep(event.to ?? 0, totalSteps),
        open: true,
        finished: false,
        dismissed: false,
      }
  }
}

/**
 * The 7 steps used by /v2/cycle. Targets refer to data-tour-step
 * attributes on the cycle page.
 */
export const CYCLE_TOUR_STEPS: CoachmarkStep[] = [
  {
    id: 'today-ring',
    target: 'today-ring',
    title: 'This is your daily check-in',
    body: 'The ring shows where you are in your cycle today, in plain language.',
  },
  {
    id: 'bbt-tile',
    target: 'bbt-tile',
    title: 'Tap to log your morning temperature',
    body: 'BBT taken right after waking is the most reliable signal. Logging it daily teaches your patterns.',
  },
  {
    id: 'phase-chip',
    target: 'phase-chip',
    title: 'This shows your current phase',
    body: 'Menstrual, follicular, ovulatory, or luteal. Each phase tip is keyed to where you are.',
  },
  {
    id: 'period-prompt',
    target: 'period-prompt',
    title: 'Tap to log your period',
    body: 'Every prediction in the app starts here. A skipped period start widens the next prediction by days.',
  },
  {
    id: 'history-link',
    target: 'history-link',
    title: 'Calendar shows your past cycles',
    body: 'Past cycles, period bars, and predicted future days. Tap any cell for the day in detail.',
  },
  {
    id: 'explainer-chip',
    target: 'explainer-chip',
    title: 'Tap any metric to learn more',
    body: 'Every chip and tile has a quiet explainer behind it. No jargon without a definition.',
  },
  {
    id: 'messages-bell',
    target: 'messages-bell',
    title: 'Insights land in your Messages',
    body: 'When the algorithm spots something worth your attention, a card shows up here. No push notifications, no nag.',
  },
]
