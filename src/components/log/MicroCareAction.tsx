'use client'

// ---------------------------------------------------------------------------
// MicroCareAction
//
// A single card in the MicroCareDrawer grid. Tapping it either logs a
// "single-tap" action directly or opens an in-card flow (timer, breathing,
// grounding). On any successful completion we call `onComplete(slug, seconds)`
// so the parent drawer can write to the API.
//
// Voice rules:
//   - Button reads "Quick action. 30 seconds." No "complete", no "task".
//   - Timer copy: "Go.", "Almost there.", "All done." Not "Goal met."
//   - Close affordance always reads "Back soon", never "Abandon".
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react'
import type { MicroCareAction as MicroCareActionDef } from '@/lib/micro-care/actions'
import GroundingExercise from '@/components/log/GroundingExercise'

interface Props {
  action: MicroCareActionDef
  onComplete: (slug: string, durationSeconds: number) => Promise<void> | void
}

type Mode = 'idle' | 'running' | 'done'

export default function MicroCareAction({ action, onComplete }: Props) {
  const [mode, setMode] = useState<Mode>('idle')
  const [remaining, setRemaining] = useState<number>(action.durationSeconds)
  const [showGrounding, setShowGrounding] = useState(false)
  const [showBreathing, setShowBreathing] = useState(false)
  const startedAtRef = useRef<number>(0)
  const timerRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current)
  }, [])

  const reset = () => {
    setMode('idle')
    setRemaining(action.durationSeconds)
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const fireComplete = async (durationSeconds: number) => {
    setMode('done')
    try {
      await onComplete(action.slug, durationSeconds)
    } catch {
      // Logging failure is non-fatal for the UI - the mental model is
      // that doing the thing matters even if the DB write hiccups.
    }
  }

  const handleTap = async () => {
    if (mode !== 'idle') return
    if (action.flow === 'none') {
      await fireComplete(action.durationSeconds)
      return
    }
    if (action.flow === 'grounding') {
      setShowGrounding(true)
      return
    }
    if (action.flow === 'breathing') {
      setShowBreathing(true)
      return
    }
    // flow === 'timer'
    startedAtRef.current = Date.now()
    setMode('running')
    setRemaining(action.durationSeconds)
    timerRef.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r > 1) return r - 1
        if (timerRef.current) {
          window.clearInterval(timerRef.current)
          timerRef.current = null
        }
        const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000)
        void fireComplete(elapsed)
        return 0
      })
    }, 1000)
  }

  const stopEarly = async () => {
    if (mode !== 'running') return
    const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000)
    await fireComplete(elapsed)
  }

  // ---- Inline grounding flow ------------------------------------------------
  if (showGrounding) {
    return (
      <GroundingExercise
        onComplete={(seconds) => {
          setShowGrounding(false)
          void fireComplete(seconds)
        }}
        onClose={() => {
          setShowGrounding(false)
          // Close without completing. No shame, no log.
        }}
      />
    )
  }

  // ---- Inline breathing flow (lightweight, local) --------------------------
  // The full 4-7-8 BreathingExercise component is used elsewhere with its
  // own UI chrome. For the drawer we render a compact 4-4-4-4 box-breathing
  // timer with explicit Close. Keeps coupling minimal.
  if (showBreathing) {
    return (
      <BoxBreathingInline
        seconds={action.durationSeconds}
        onComplete={(seconds) => {
          setShowBreathing(false)
          void fireComplete(seconds)
        }}
        onClose={() => setShowBreathing(false)}
      />
    )
  }

  // ---- Idle / running / done card -----------------------------------------
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-2"
      style={{
        background: '#FFFDF9',
        border: '1px solid rgba(107, 144, 128, 0.15)',
        minHeight: 128,
      }}
    >
      <div className="flex items-center gap-2">
        <span aria-hidden style={{ fontSize: 20 }}>{action.icon}</span>
        <div className="text-sm font-medium" style={{ color: '#3a3a3a' }}>
          {action.label}
        </div>
      </div>
      <div className="text-xs" style={{ color: '#8a8a8a' }}>
        {action.subtitle}
      </div>
      {mode === 'running' ? (
        <div className="mt-auto flex items-center justify-between">
          <span className="tabular text-xs" style={{ color: '#6B9080' }}>
            {formatRemaining(remaining)}
          </span>
          <button
            type="button"
            onClick={stopEarly}
            className="press-feedback px-3 py-1.5 rounded-full text-xs font-medium"
            style={{
              background: 'transparent',
              color: '#6B9080',
              border: '1px solid #6B9080',
            }}
          >
            Done
          </button>
        </div>
      ) : mode === 'done' ? (
        <div className="mt-auto flex items-center justify-between">
          <span className="text-xs" style={{ color: '#6B9080' }}>
            Logged.
          </span>
          <button
            type="button"
            onClick={reset}
            className="press-feedback px-3 py-1.5 rounded-full text-xs font-medium"
            style={{
              background: 'transparent',
              color: '#6B9080',
              border: '1px solid #6B9080',
            }}
          >
            Again
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleTap}
          className="press-feedback mt-auto py-2 rounded-full text-xs font-semibold"
          style={{
            background: '#6B9080',
            color: '#fff',
            border: '1px solid #6B9080',
          }}
          aria-label={`Start micro-care: ${action.label}`}
        >
          Quick action. 30 seconds.
        </button>
      )}
    </div>
  )
}

function formatRemaining(seconds: number): string {
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }
  return `${seconds}s`
}

// ---------------------------------------------------------------------------
// Compact box-breathing timer used inside the drawer. Not exported: the
// full 4-7-8 breathing panel lives in src/components/log/BreathingExercise
// and is preserved unchanged for existing callers per the brief.
// ---------------------------------------------------------------------------
function BoxBreathingInline({
  seconds,
  onComplete,
  onClose,
}: {
  seconds: number
  onComplete: (secs: number) => void
  onClose: () => void
}) {
  const phases: Array<{ label: string; dur: number }> = [
    { label: 'Inhale', dur: 4 },
    { label: 'Hold', dur: 4 },
    { label: 'Exhale', dur: 4 },
    { label: 'Hold', dur: 4 },
  ]
  const [phaseIdx, setPhaseIdx] = useState(0)
  const [phaseRemaining, setPhaseRemaining] = useState(phases[0].dur)
  const [totalRemaining, setTotalRemaining] = useState(seconds)
  const startedAtRef = useRef(Date.now())
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    timerRef.current = window.setInterval(() => {
      setTotalRemaining((t) => {
        if (t > 1) return t - 1
        if (timerRef.current) {
          window.clearInterval(timerRef.current)
          timerRef.current = null
        }
        const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000)
        onComplete(elapsed)
        return 0
      })
      setPhaseRemaining((r) => {
        if (r > 1) return r - 1
        setPhaseIdx((i) => (i + 1) % phases.length)
        return phases[(phaseIdx + 1) % phases.length].dur
      })
    }, 1000)
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const phase = phases[phaseIdx]
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
          transition: 'transform 4s ease-in-out',
          transform:
            phase.label === 'Inhale'
              ? 'scale(1.2)'
              : phase.label === 'Exhale'
                ? 'scale(0.8)'
                : 'scale(1)',
        }}
      >
        <div className="text-sm font-semibold">{phase.label}</div>
      </div>
      <div className="text-xs tabular" style={{ color: '#8a8a8a' }}>
        {phaseRemaining}s - {totalRemaining}s total
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
        Back soon
      </button>
    </div>
  )
}
