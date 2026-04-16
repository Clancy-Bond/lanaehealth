'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { createServiceClient } from '@/lib/supabase'
import SaveIndicator from './SaveIndicator'

interface Medication {
  id: string
  name: string
  dose: string | null
  frequency: string | null
  is_prn: boolean
  max_daily_dose: number | null
}

interface DoseLog {
  id: string
  medication_id: string
  taken_at: string
  status: 'taken' | 'skipped' | 'late'
}

interface MedicationCardProps {
  date: string
  onComplete?: () => void
}

// Placeholder medications -- in production, fetched from health_profile
const DEFAULT_MEDICATIONS: Medication[] = [
  { id: 'iron', name: 'Iron Supplement', dose: '325mg', frequency: 'daily', is_prn: false, max_daily_dose: null },
  { id: 'vitd', name: 'Vitamin D', dose: '5000 IU', frequency: 'daily', is_prn: false, max_daily_dose: null },
  { id: 'tylenol', name: 'Tylenol', dose: '500mg', frequency: 'as needed', is_prn: true, max_daily_dose: 4000 },
  { id: 'ibuprofen', name: 'Ibuprofen', dose: '400mg', frequency: 'as needed', is_prn: true, max_daily_dose: 1200 },
]

function timeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 0) return `${hours}h ${mins}m ago`
  return `${mins}m ago`
}

export default function MedicationCard({ date, onComplete }: MedicationCardProps) {
  const [medications] = useState<Medication[]>(DEFAULT_MEDICATIONS)
  const [doses, setDoses] = useState<Map<string, DoseLog[]>>(new Map())
  const [saved, setSaved] = useState(false)
  const hasCalledComplete = useRef(false)

  const flashSaved = useCallback(() => {
    setSaved(true)
    setTimeout(() => setSaved(false), 1600)
  }, [])

  const handleTakeDose = useCallback(async (med: Medication) => {
    const now = new Date().toISOString()
    const newDose: DoseLog = {
      id: crypto.randomUUID(),
      medication_id: med.id,
      taken_at: now,
      status: 'taken',
    }

    // Optimistic update
    setDoses(prev => {
      const next = new Map(prev)
      const existing = next.get(med.id) ?? []
      next.set(med.id, [...existing, newDose])
      return next
    })

    if (!hasCalledComplete.current && onComplete) {
      hasCalledComplete.current = true
      onComplete()
    }

    try {
      const sb = createServiceClient()
      // Store as a medical timeline event
      await sb.from('medical_timeline').insert({
        date,
        event_type: 'medication_change',
        title: `${med.name} ${med.dose ?? ''} taken`,
        description: `Logged at ${new Date(now).toLocaleTimeString()}${med.is_prn ? ' (PRN)' : ''}`,
        significance: 'normal',
        source: 'daily_log',
      })
      flashSaved()
    } catch {
      // Revert on failure
      setDoses(prev => {
        const next = new Map(prev)
        const existing = next.get(med.id) ?? []
        next.set(med.id, existing.filter(d => d.id !== newDose.id))
        return next
      })
    }
  }, [date, flashSaved, onComplete])

  const handleSkip = useCallback(async (med: Medication) => {
    try {
      const sb = createServiceClient()
      await sb.from('medical_timeline').insert({
        date,
        event_type: 'medication_change',
        title: `${med.name} skipped`,
        description: 'Logged as skipped',
        significance: 'normal',
        source: 'daily_log',
      })

      setDoses(prev => {
        const next = new Map(prev)
        const existing = next.get(med.id) ?? []
        next.set(med.id, [...existing, {
          id: crypto.randomUUID(),
          medication_id: med.id,
          taken_at: new Date().toISOString(),
          status: 'skipped' as const,
        }])
        return next
      })
      flashSaved()
    } catch {
      // Silently fail
    }
  }, [date, flashSaved])

  const scheduledMeds = medications.filter(m => !m.is_prn)
  const prnMeds = medications.filter(m => m.is_prn)

  return (
    <div
      className="card"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-light)',
        borderRadius: '1rem',
      }}
    >
      <div className="px-4 py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3
            className="text-base font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            Medications
          </h3>
          <SaveIndicator show={saved} />
        </div>

        {/* Scheduled Medications */}
        {scheduledMeds.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Scheduled
            </p>
            {scheduledMeds.map(med => {
              const medDoses = doses.get(med.id) ?? []
              const taken = medDoses.some(d => d.status === 'taken')
              const skipped = medDoses.some(d => d.status === 'skipped')

              return (
                <div
                  key={med.id}
                  className="flex items-center gap-3 rounded-lg p-2.5"
                  style={{
                    background: taken ? 'var(--accent-sage-muted)' : 'var(--bg-elevated)',
                    border: taken ? '1px solid var(--accent-sage)' : '1px solid var(--border-light)',
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {med.name}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {med.dose} - {med.frequency}
                    </p>
                  </div>
                  {taken ? (
                    <div className="flex items-center gap-1.5">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8L6.5 11.5L13 4.5" stroke="var(--accent-sage)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-xs font-medium" style={{ color: 'var(--accent-sage)' }}>Taken</span>
                    </div>
                  ) : skipped ? (
                    <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Skipped</span>
                  ) : (
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleTakeDose(med)}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                        style={{ background: 'var(--accent-sage)', minHeight: 32 }}
                      >
                        Take
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSkip(med)}
                        className="rounded-lg px-2 py-1.5 text-xs font-medium"
                        style={{ background: 'transparent', color: 'var(--text-muted)', minHeight: 32 }}
                      >
                        Skip
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* PRN Medications */}
        {prnMeds.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              As Needed (PRN)
            </p>
            {prnMeds.map(med => {
              const medDoses = doses.get(med.id) ?? []
              const takenDoses = medDoses.filter(d => d.status === 'taken')
              const lastDose = takenDoses[takenDoses.length - 1]

              return (
                <div
                  key={med.id}
                  className="flex items-center gap-3 rounded-lg p-2.5"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-light)' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {med.name} {med.dose ?? ''}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {lastDose && (
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          Last: {timeSince(lastDose.taken_at)}
                        </span>
                      )}
                      {takenDoses.length > 0 && (
                        <span className="text-[10px] font-semibold" style={{ color: 'var(--accent-sage)' }}>
                          {takenDoses.length}x today
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTakeDose(med)}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                    style={{
                      background: 'var(--accent-sage-muted)',
                      color: 'var(--accent-sage)',
                      minHeight: 32,
                    }}
                  >
                    + Dose
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
