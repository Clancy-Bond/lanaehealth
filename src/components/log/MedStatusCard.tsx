'use client'

import { useMemo, useState } from 'react'
import { updateDailyLog } from '@/lib/api/logs'
import type { DailyLog } from '@/lib/types'
import type { CheckInPrefill } from '@/lib/log/prefill'

interface MedStatusCardProps {
  log: DailyLog
  availableMeds: CheckInPrefill['availableMeds']
  onOpenDetails: () => void
}

interface MedEntry {
  name: string
  time: string
  dose?: string
}

function nowHHMM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function readLogMeds(log: DailyLog): MedEntry[] {
  const raw = (log as unknown as Record<string, unknown>).medications
  if (!Array.isArray(raw)) return []
  return raw.filter(m => m && typeof m === 'object' && 'name' in m) as MedEntry[]
}

export default function MedStatusCard({ log, availableMeds, onOpenDetails }: MedStatusCardProps) {
  const [meds, setMeds] = useState<MedEntry[]>(() => readLogMeds(log))
  const [saving, setSaving] = useState(false)

  const loggedNames = useMemo(() => new Set(meds.map(m => m.name.toLowerCase())), [meds])
  const hasAvailable = availableMeds.length > 0

  const persist = async (next: MedEntry[]) => {
    setSaving(true)
    try {
      await updateDailyLog(log.id, { medications: next } as unknown as Parameters<typeof updateDailyLog>[1])
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (med: { name: string; dose: string }) => {
    const key = med.name.toLowerCase()
    let next: MedEntry[]
    if (loggedNames.has(key)) {
      next = meds.filter(m => m.name.toLowerCase() !== key)
    } else {
      next = [...meds, { name: med.name, dose: med.dose, time: nowHHMM() }]
    }
    setMeds(next)
    persist(next)
  }

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: '#FFFDF9', border: '1px solid rgba(107, 144, 128, 0.15)' }}
    >
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="text-sm font-medium" style={{ color: '#3a3a3a' }}>
          Medications today
          <span className="ml-2 text-xs font-normal" style={{ color: '#8a8a8a' }}>
            <span className="tabular">{meds.length}</span> logged
          </span>
        </h3>
        <button
          onClick={onOpenDetails}
          className="press-feedback text-xs underline"
          style={{ color: '#6B9080' }}
        >
          Edit in detail
        </button>
      </div>

      {hasAvailable ? (
        <div className="flex flex-wrap gap-2">
          {availableMeds.map(m => {
            const key = m.name.toLowerCase()
            const active = loggedNames.has(key)
            const logged = meds.find(x => x.name.toLowerCase() === key)
            return (
              <button
                key={m.name}
                type="button"
                onClick={() => toggle(m)}
                disabled={saving}
                className="press-feedback inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm"
                style={{
                  background: active ? '#6B9080' : 'transparent',
                  color: active ? '#fff' : '#3a3a3a',
                  border: `1px solid ${active ? '#6B9080' : 'rgba(107, 144, 128, 0.25)'}`,
                  opacity: saving ? 0.7 : 1,
                  transition: `background var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard)`,
                }}
                aria-pressed={active}
                title={`${m.name}${m.dose ? `: ${m.dose}` : ''}${logged ? ` \u00b7 taken at ${logged.time}` : ''}`}
              >
                {active ? <span aria-hidden>&#10003;</span> : null}
                <span>{m.name}</span>
                {active && logged?.time ? (
                  <span className="tabular text-[10px] opacity-80">{logged.time}</span>
                ) : null}
              </button>
            )
          })}
        </div>
      ) : (
        <p className="text-sm" style={{ color: '#8a8a8a' }}>
          No meds on file yet. Tap Edit in detail to add your first.
        </p>
      )}
    </div>
  )
}
