'use client'

import { useEffect, useRef, useState } from 'react'

const STORAGE_PREFIX = 'lanae.orthostatic.'

interface OrthostaticState {
  resting: number | null
  standing: number | null
  recordedAt: string | null
}

function key(date: string): string {
  return STORAGE_PREFIX + date
}

function load(date: string): OrthostaticState {
  if (typeof window === 'undefined') return { resting: null, standing: null, recordedAt: null }
  try {
    const raw = localStorage.getItem(key(date))
    if (!raw) return { resting: null, standing: null, recordedAt: null }
    return JSON.parse(raw) as OrthostaticState
  } catch {
    return { resting: null, standing: null, recordedAt: null }
  }
}

function save(date: string, state: OrthostaticState): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(key(date), JSON.stringify(state))
}

interface OrthostaticRowProps {
  date: string
}

export default function OrthostaticRow({ date }: OrthostaticRowProps) {
  const [state, setState] = useState<OrthostaticState>({ resting: null, standing: null, recordedAt: null })
  const [mounted, setMounted] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    setMounted(true)
    setState(load(date))
  }, [date])

  useEffect(() => {
    if (countdown === null) return
    if (countdown <= 0) {
      setCountdown(null)
      return
    }
    timerRef.current = window.setTimeout(() => setCountdown(c => (c === null ? null : c - 1)), 1000)
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [countdown])

  if (!mounted) return null

  const setResting = (v: number) => {
    const next = { ...state, resting: isNaN(v) ? null : v, recordedAt: new Date().toISOString() }
    setState(next)
    save(date, next)
  }
  const setStanding = (v: number) => {
    const next = { ...state, standing: isNaN(v) ? null : v, recordedAt: new Date().toISOString() }
    setState(next)
    save(date, next)
  }

  const delta = state.resting !== null && state.standing !== null ? state.standing - state.resting : null
  const potsPositive = delta !== null && delta >= 30
  const elevated = delta !== null && delta >= 20 && delta < 30

  return (
    <details
      className="rounded-2xl"
      style={{ background: '#FFFDF9', border: '1px solid rgba(107, 144, 128, 0.15)' }}
    >
      <summary className="p-5 cursor-pointer flex items-center gap-3" style={{ color: '#3a3a3a' }}>
        <span aria-hidden className="text-xl">&#x1F493;</span>
        <div className="flex-1">
          <div className="text-sm font-medium">Orthostatic check (optional)</div>
          <div className="text-xs" style={{ color: '#8a8a8a' }}>
            {delta === null
              ? <>Standing HR vs resting. <span className="tabular">&ge; 30 bpm</span> meets POTS criterion.</>
              : <><span className="tabular">Δ {delta} bpm</span> {potsPositive ? '(POTS positive)' : elevated ? '(elevated)' : '(normal)'}</>}
          </div>
        </div>
        <span aria-hidden style={{ color: '#6B9080' }}>&#x25BE;</span>
      </summary>
      <div className="px-5 pb-5 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs" style={{ color: '#6a6a6a' }}>
            Resting HR (bpm)
            <input
              type="number"
              value={state.resting ?? ''}
              onChange={e => setResting(Number(e.target.value))}
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: '#FAFAF7', border: '1px solid rgba(107, 144, 128, 0.2)', color: '#3a3a3a' }}
              placeholder="60"
              min={30}
              max={200}
            />
          </label>
          <label className="text-xs" style={{ color: '#6a6a6a' }}>
            Standing HR (bpm)
            <input
              type="number"
              value={state.standing ?? ''}
              onChange={e => setStanding(Number(e.target.value))}
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: '#FAFAF7', border: '1px solid rgba(107, 144, 128, 0.2)', color: '#3a3a3a' }}
              placeholder="90"
              min={30}
              max={220}
            />
          </label>
        </div>

        {delta !== null ? (
          <div
            className="rounded-xl p-3 text-sm"
            style={{
              background: potsPositive ? '#D4A0A0' : elevated ? '#E8D5B7' : '#E8EDE6',
              color: potsPositive ? '#fff' : elevated ? '#3a2e1f' : '#4A6B52',
            }}
          >
            <span className="tabular">Δ {delta} bpm</span>. {potsPositive ? 'Meets POTS orthostatic criterion (≥30)' : elevated ? 'Elevated orthostatic response' : 'Within normal limits'}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setCountdown(60)}
          disabled={countdown !== null}
          className="press-feedback w-full py-2 rounded-full text-sm font-medium"
          style={{
            background: countdown !== null ? 'transparent' : '#6B9080',
            color: countdown !== null ? '#6B9080' : '#fff',
            border: '1px solid #6B9080',
            transition: `background var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard)`,
          }}
        >
          {countdown !== null ? <>Stand and hold. <span className="tabular">{countdown}s</span></> : 'Start 60-sec stand timer'}
        </button>
      </div>
    </details>
  )
}
