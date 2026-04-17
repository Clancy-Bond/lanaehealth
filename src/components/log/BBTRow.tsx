'use client'

import { useEffect, useState } from 'react'

const STORAGE_PREFIX = 'lanae.bbt.'

interface BBTRowProps {
  date: string
}

function key(date: string): string {
  return STORAGE_PREFIX + date
}

function load(date: string): number | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key(date))
    if (!raw) return null
    const n = Number(raw)
    return isNaN(n) ? null : n
  } catch {
    return null
  }
}

function save(date: string, value: number | null): void {
  if (typeof window === 'undefined') return
  if (value === null) {
    localStorage.removeItem(key(date))
  } else {
    localStorage.setItem(key(date), String(value))
  }
}

export default function BBTRow({ date }: BBTRowProps) {
  const [temp, setTemp] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setTemp(load(date))
  }, [date])

  const update = (v: number) => {
    const normalized = isNaN(v) ? null : v
    setTemp(normalized)
    save(date, normalized)
  }

  if (!mounted) return null

  const phase =
    temp === null ? null :
    temp < 97.4 ? 'low' :
    temp < 97.9 ? 'follicular' :
    temp < 98.6 ? 'post-ovulation' :
    'elevated'

  const phaseColor =
    phase === 'low' ? '#6B9080' :
    phase === 'follicular' ? '#CCB167' :
    phase === 'post-ovulation' ? '#A67BA6' :
    phase === 'elevated' ? '#D4A0A0' :
    '#8a8a8a'

  return (
    <details
      className="rounded-2xl"
      style={{ background: '#FFFDF9', border: '1px solid rgba(107, 144, 128, 0.15)' }}
    >
      <summary className="p-5 cursor-pointer flex items-center gap-3" style={{ color: '#3a3a3a' }}>
        <span aria-hidden className="text-xl">&#x1F321;&#xFE0F;</span>
        <div className="flex-1">
          <div className="text-sm font-medium">Basal body temperature</div>
          <div className="text-xs" style={{ color: phaseColor }}>
            {temp === null ? 'Take before getting out of bed' : `${temp}°F \u00b7 ${phase ?? ''}`}
          </div>
        </div>
        <span aria-hidden style={{ color: '#6B9080' }}>&#x25BE;</span>
      </summary>
      <div className="px-5 pb-5 space-y-3">
        <label className="block text-xs" style={{ color: '#6a6a6a' }}>
          Temperature (°F)
          <input
            type="number"
            step="0.01"
            value={temp ?? ''}
            onChange={e => update(Number(e.target.value))}
            className="mt-1 w-full rounded-lg px-3 py-2 text-sm"
            style={{ background: '#FAFAF7', border: '1px solid rgba(107, 144, 128, 0.2)', color: '#3a3a3a' }}
            placeholder="97.5"
            min={95}
            max={102}
          />
        </label>
        {temp !== null ? (
          <div className="text-xs" style={{ color: '#6a6a6a' }}>
            Reference: <span style={{ color: '#6B9080' }}>&lt; 97.4 pre-ovulation</span> &middot;{' '}
            <span style={{ color: '#A67BA6' }}>97.9+ likely post-ovulation</span> &middot;{' '}
            <span style={{ color: '#D4A0A0' }}>&gt; 98.6 elevated</span>
          </div>
        ) : null}
      </div>
    </details>
  )
}
