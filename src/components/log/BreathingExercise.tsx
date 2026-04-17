'use client'

import { useEffect, useRef, useState } from 'react'

type Phase = 'inhale' | 'hold' | 'exhale' | 'rest'

const SEQUENCE: Array<{ phase: Phase; seconds: number; label: string }> = [
  { phase: 'inhale', seconds: 4, label: 'Inhale' },
  { phase: 'hold',   seconds: 7, label: 'Hold' },
  { phase: 'exhale', seconds: 8, label: 'Exhale' },
  { phase: 'rest',   seconds: 1, label: 'Rest' },
]

export default function BreathingExercise() {
  const [running, setRunning] = useState(false)
  const [cycleCount, setCycleCount] = useState(0)
  const [stepIdx, setStepIdx] = useState(0)
  const [remaining, setRemaining] = useState(SEQUENCE[0].seconds)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!running) {
      if (timerRef.current) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }
    timerRef.current = window.setInterval(() => {
      setRemaining(prev => {
        if (prev > 1) return prev - 1
        setStepIdx(idx => {
          const next = (idx + 1) % SEQUENCE.length
          if (next === 0) setCycleCount(c => c + 1)
          setRemaining(SEQUENCE[next].seconds)
          return next
        })
        return SEQUENCE[(stepIdx + 1) % SEQUENCE.length].seconds
      })
    }, 1000)
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  const step = SEQUENCE[stepIdx]
  const start = () => { setCycleCount(0); setStepIdx(0); setRemaining(SEQUENCE[0].seconds); setRunning(true) }
  const stop = () => { setRunning(false) }
  const scale = step.phase === 'inhale' ? 1.2 : step.phase === 'exhale' ? 0.8 : 1.0

  return (
    <details
      className="rounded-2xl"
      style={{ background: '#FFFDF9', border: '1px solid rgba(107, 144, 128, 0.15)' }}
    >
      <summary
        className="p-5 cursor-pointer flex items-center gap-3"
        style={{ color: '#3a3a3a' }}
      >
        <span aria-hidden className="text-xl">&#x1F343;</span>
        <div className="flex-1">
          <div className="text-sm font-medium">Quick breath reset</div>
          <div className="text-xs" style={{ color: '#8a8a8a' }}>
            4-7-8 breathing helps vagal tone (POTS)
          </div>
        </div>
        <span aria-hidden style={{ color: '#6B9080' }}>&#x25BE;</span>
      </summary>
      <div className="px-5 pb-5">
        <div className="flex flex-col items-center py-4">
          <div
            className="w-28 h-28 rounded-full flex items-center justify-center transition-transform"
            style={{
              background: running ? 'radial-gradient(circle, #9FB8A8 0%, #6B9080 100%)' : 'rgba(107, 144, 128, 0.15)',
              transform: `scale(${running ? scale : 1})`,
              transitionDuration: step.phase === 'inhale' ? '4s' : step.phase === 'exhale' ? '8s' : '0.5s',
              color: running ? '#fff' : '#6B9080',
            }}
          >
            <div className="text-center">
              <div className="text-xl font-semibold">{running ? step.label : 'Ready'}</div>
              {running ? <div className="tabular text-2xl">{remaining}s</div> : null}
            </div>
          </div>
          <div className="text-xs mt-3" style={{ color: '#8a8a8a' }}>
            {running ? <>Cycle <span className="tabular">{cycleCount + 1}</span> in progress</> : 'Tap start, breathe with the circle'}
          </div>
        </div>
        <button
          type="button"
          onClick={running ? stop : start}
          className="press-feedback w-full py-2 rounded-full text-sm font-medium"
          style={{
            background: running ? 'transparent' : '#6B9080',
            color: running ? '#6B9080' : '#fff',
            border: `1px solid #6B9080`,
            transition: `background var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard)`,
          }}
        >
          {running ? 'Stop' : 'Start 4-7-8 breathing'}
        </button>
      </div>
    </details>
  )
}
