'use client'

// ---------------------------------------------------------------------------
// GroundingExercise - 5-4-3-2-1 sensory grounding
//
// Guided flow for anxiety + pain distraction. Shown inside the Micro-Care
// Drawer when the user taps the grounding card. Five steps, each ~15 seconds.
//
// Voice rules: step copy is an OFFER, not a command. "Notice 5 things you
// can see" not "You must name 5 things." A Close button is always visible
// and never framed as abandonment.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react'

interface Step {
  n: number
  sense: string
  prompt: string
}

const STEPS: readonly Step[] = [
  { n: 5, sense: 'see',   prompt: 'Notice 5 things you can see.' },
  { n: 4, sense: 'feel',  prompt: 'Notice 4 things you can feel.' },
  { n: 3, sense: 'hear',  prompt: 'Notice 3 things you can hear.' },
  { n: 2, sense: 'smell', prompt: 'Notice 2 things you can smell.' },
  { n: 1, sense: 'taste', prompt: 'Notice 1 thing you can taste.' },
]

const SECONDS_PER_STEP = 15

export default function GroundingExercise({
  onComplete,
  onClose,
}: {
  onComplete?: (durationSeconds: number) => void
  onClose?: () => void
}) {
  const [stepIdx, setStepIdx] = useState(0)
  const [remaining, setRemaining] = useState(SECONDS_PER_STEP)
  const startedAtRef = useRef<number>(Date.now())
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    timerRef.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r > 1) return r - 1
        // Advance to next step or complete.
        setStepIdx((idx) => {
          if (idx < STEPS.length - 1) return idx + 1
          // Final step finished.
          if (timerRef.current) {
            window.clearInterval(timerRef.current)
            timerRef.current = null
          }
          const duration = Math.round((Date.now() - startedAtRef.current) / 1000)
          onComplete?.(duration)
          return idx
        })
        return SECONDS_PER_STEP
      })
    }, 1000)
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const step = STEPS[stepIdx]
  const isFinal = stepIdx === STEPS.length - 1 && remaining === 1

  return (
    <div
      className="rounded-2xl p-5 flex flex-col items-center"
      style={{
        background: '#FFFDF9',
        border: '1px solid rgba(107, 144, 128, 0.15)',
      }}
    >
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-3"
        style={{
          background: 'radial-gradient(circle, #9FB8A8 0%, #6B9080 100%)',
          color: '#fff',
          fontSize: 28,
          fontWeight: 600,
        }}
      >
        {step.n}
      </div>
      <div className="text-base font-medium text-center" style={{ color: '#3a3a3a' }}>
        {step.prompt}
      </div>
      <div className="text-xs mt-1 tabular" style={{ color: '#8a8a8a' }}>
        {isFinal ? 'All done.' : `${remaining}s`}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="press-feedback mt-4 px-4 py-2 rounded-full text-sm font-medium"
        style={{
          background: 'transparent',
          color: '#6B9080',
          border: '1px solid #6B9080',
        }}
      >
        {isFinal ? 'Back soon' : 'Close'}
      </button>
    </div>
  )
}
