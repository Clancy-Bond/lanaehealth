'use client'

import { useEffect, useState } from 'react'

interface HydrationRowProps {
  date: string
}

const STORAGE_PREFIX = 'lanae.hydration.'

interface DayState {
  water: number
  electrolytes: number
}

function key(date: string): string {
  return STORAGE_PREFIX + date
}

function load(date: string): DayState {
  if (typeof window === 'undefined') return { water: 0, electrolytes: 0 }
  try {
    const raw = localStorage.getItem(key(date))
    if (!raw) return { water: 0, electrolytes: 0 }
    return JSON.parse(raw) as DayState
  } catch {
    return { water: 0, electrolytes: 0 }
  }
}

function save(date: string, state: DayState): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(key(date), JSON.stringify(state))
}

export default function HydrationRow({ date }: HydrationRowProps) {
  const [state, setState] = useState<DayState>({ water: 0, electrolytes: 0 })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setState(load(date))
  }, [date])

  const bump = (field: keyof DayState, delta: number) => {
    const next = { ...state, [field]: Math.max(0, state[field] + delta) }
    setState(next)
    save(date, next)
  }

  if (!mounted) return null

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: '#FFFDF9', border: '1px solid rgba(107, 144, 128, 0.15)' }}
    >
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="text-sm font-medium" style={{ color: '#3a3a3a' }}>
          Hydration
          <span className="ml-2 text-xs font-normal" style={{ color: '#8a8a8a' }}>
            POTS needs &ge; 2.5L + electrolytes
          </span>
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Counter
          label="Water cups"
          icon="💧"
          value={state.water}
          target={10}
          onBump={(d) => bump('water', d)}
        />
        <Counter
          label="Electrolyte"
          icon="⚡"
          value={state.electrolytes}
          target={2}
          onBump={(d) => bump('electrolytes', d)}
        />
      </div>
    </div>
  )
}

interface CounterProps {
  label: string
  icon: string
  value: number
  target: number
  onBump: (delta: number) => void
}

function Counter({ label, icon, value, target, onBump }: CounterProps) {
  const pct = Math.min(100, Math.round((value / target) * 100))
  const color = value >= target ? '#6B9080' : value >= target / 2 ? '#E8A849' : '#D4A0A0'
  return (
    <div
      className="rounded-xl p-3"
      style={{ background: '#FAFAF7', border: '1px solid rgba(107, 144, 128, 0.12)' }}
    >
      <div className="text-xs uppercase tracking-wide flex items-center gap-1" style={{ color: '#8a8a8a' }}>
        <span aria-hidden>{icon}</span> {label}
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-2xl font-semibold" style={{ color }}>
          {value}<span className="text-sm font-normal opacity-60">/{target}</span>
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onBump(-1)}
            className="w-7 h-7 rounded-full text-sm font-bold"
            style={{ background: 'transparent', color: '#8a8a8a', border: '1px solid rgba(107, 144, 128, 0.25)' }}
            aria-label={`Decrease ${label}`}
          >
            &minus;
          </button>
          <button
            type="button"
            onClick={() => onBump(1)}
            className="w-7 h-7 rounded-full text-sm font-bold"
            style={{ background: '#6B9080', color: '#fff' }}
            aria-label={`Increase ${label}`}
          >
            +
          </button>
        </div>
      </div>
      <div className="mt-2 h-1.5 rounded-full" style={{ background: 'rgba(107, 144, 128, 0.1)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}
