'use client'

import { useState, useCallback } from 'react'
import { addPainPoint } from '@/lib/api/logs'
import { refreshTodayNarrative } from '@/lib/log/narrative-refresh'
import type { PainPoint } from '@/lib/types'

interface PainRegionRowProps {
  logId: string
  initialPainPoints: PainPoint[]
  intensity: number
  onAutoBumpIntensity?: (next: number) => void
  label?: string
}

const REGIONS: Array<{ region: string; x: number; y: number }> = [
  { region: 'Head',         x: 50, y: 8  },
  { region: 'Neck',         x: 50, y: 14 },
  { region: 'Chest',        x: 50, y: 24 },
  { region: 'Upper back',   x: 50, y: 24 },
  { region: 'Lower back',   x: 50, y: 40 },
  { region: 'Abdomen',      x: 50, y: 36 },
  { region: 'Pelvis',       x: 50, y: 46 },
  { region: 'Left hip',     x: 44, y: 50 },
  { region: 'Right hip',    x: 56, y: 50 },
  { region: 'Legs',         x: 50, y: 70 },
]

export default function PainRegionRow({
  logId,
  initialPainPoints,
  intensity,
  onAutoBumpIntensity,
  label = 'Where does it hurt?',
}: PainRegionRowProps) {
  const initialRegions = new Set(initialPainPoints.map(p => p.body_region))
  const [logged, setLogged] = useState<Set<string>>(initialRegions)
  const [busy, setBusy] = useState<string | null>(null)

  const addRegion = useCallback(async (region: string, x: number, y: number) => {
    if (logged.has(region) || busy) return
    setBusy(region)
    const effectiveIntensity = Math.max(1, intensity)
    if (intensity === 0 && onAutoBumpIntensity) onAutoBumpIntensity(effectiveIntensity)
    try {
      await addPainPoint({
        log_id: logId,
        x,
        y,
        body_region: region,
        intensity: effectiveIntensity,
        pain_type: null,
        duration_minutes: null,
      })
      setLogged(prev => new Set(prev).add(region))
      refreshTodayNarrative()
    } finally {
      setBusy(null)
    }
  }, [logged, busy, logId, intensity, onAutoBumpIntensity])

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: '#FFFDF9', border: '1px solid rgba(107, 144, 128, 0.15)' }}
    >
      <label className="block text-sm font-medium mb-3" style={{ color: '#3a3a3a' }}>
        {label}
        <span className="ml-2 text-xs font-normal" style={{ color: '#8a8a8a' }}>
          {intensity > 0 ? `Logs at intensity ${intensity}` : 'Tap to mark; pain set to 1 if not yet set'}
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        {REGIONS.map(r => {
          const active = logged.has(r.region)
          const disabled = busy === r.region || active
          return (
            <button
              key={r.region}
              type="button"
              onClick={() => addRegion(r.region, r.x, r.y)}
              disabled={disabled}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-full text-sm transition"
              style={{
                background: active ? '#D4A0A0' : 'transparent',
                color: active ? '#fff' : '#6a6a6a',
                border: `1px solid ${active ? '#D4A0A0' : 'rgba(107, 144, 128, 0.25)'}`,
                opacity: disabled && !active ? 0.5 : 1,
              }}
              aria-pressed={active}
            >
              {active ? <span aria-hidden>&#10003;</span> : null}
              {r.region}
            </button>
          )
        })}
      </div>
    </div>
  )
}
