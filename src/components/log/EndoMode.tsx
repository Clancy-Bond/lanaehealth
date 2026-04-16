'use client'

/**
 * Endometriosis Mode
 *
 * Renders extended cycle tracking when user has endometriosis in their
 * conditions array. Clinical significance:
 * - Bowel symptoms (dyschezia) in 40-60% of endo patients
 * - Bladder symptoms (dysuria) in 15-40%
 * - Dyspareunia (painful intercourse) in 40-70%
 * - Clot tracking supports heavy menstrual bleeding (HMB) assessment
 *
 * Data goes into cycle_entries extended columns (migration 011).
 * These fields feed into the endometriosis condition report (/api/reports/condition).
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { updateCycleEntry } from '@/lib/api/cycle'
import type { CycleEntry, ClotSize } from '@/lib/types'
import SaveIndicator from './SaveIndicator'

interface EndoModeProps {
  date: string
  initialEntry: CycleEntry | null
}

const BOWEL_SYMPTOMS = [
  { value: 'constipation', label: 'Constipation' },
  { value: 'diarrhea', label: 'Diarrhea' },
  { value: 'painful_bm', label: 'Painful BM (dyschezia)' },
  { value: 'bleeding', label: 'Rectal bleeding' },
  { value: 'urgency', label: 'Urgency' },
  { value: 'incomplete_evacuation', label: 'Incomplete evacuation' },
]

const BLADDER_SYMPTOMS = [
  { value: 'painful_urination', label: 'Painful urination (dysuria)' },
  { value: 'urgency', label: 'Urinary urgency' },
  { value: 'frequency', label: 'Frequency' },
  { value: 'incomplete_emptying', label: 'Incomplete emptying' },
  { value: 'blood_in_urine', label: 'Blood in urine' },
]

const CLOT_SIZES: { value: ClotSize; label: string; reference: string }[] = [
  { value: 'small', label: 'Small', reference: '< pea sized' },
  { value: 'medium', label: 'Medium', reference: 'grape to strawberry' },
  { value: 'large', label: 'Large', reference: 'plum sized' },
  { value: 'very_large', label: 'Very large', reference: 'golf ball +' },
]

export default function EndoMode({ date, initialEntry }: EndoModeProps) {
  const [bowelSymptoms, setBowelSymptoms] = useState<string[]>(initialEntry?.bowel_symptoms ?? [])
  const [bladderSymptoms, setBladderSymptoms] = useState<string[]>(initialEntry?.bladder_symptoms ?? [])
  const [dyspareunia, setDyspareunia] = useState<boolean>(initialEntry?.dyspareunia ?? false)
  const [dyspareuniaIntensity, setDyspareuniaIntensity] = useState<number>(
    initialEntry?.dyspareunia_intensity ?? 5
  )
  const [clotsPresent, setClotsPresent] = useState<boolean>(initialEntry?.clots_present ?? false)
  const [clotSize, setClotSize] = useState<ClotSize | null>(initialEntry?.clot_size ?? null)
  const [clotCount, setClotCount] = useState<number | null>(initialEntry?.clot_count ?? null)
  const [notes, setNotes] = useState<string>(initialEntry?.endo_notes ?? '')
  const [saved, setSaved] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const debouncedSave = useCallback(
    (updates: Partial<CycleEntry>) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        try {
          await updateCycleEntry(date, updates)
          setSaved(true)
          setTimeout(() => setSaved(false), 1600)
        } catch {
          // Silently fail
        }
      }, 500)
    },
    [date],
  )

  const toggleBowelSymptom = useCallback((sym: string) => {
    setBowelSymptoms(prev => {
      const next = prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym]
      debouncedSave({ bowel_symptoms: next })
      return next
    })
  }, [debouncedSave])

  const toggleBladderSymptom = useCallback((sym: string) => {
    setBladderSymptoms(prev => {
      const next = prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym]
      debouncedSave({ bladder_symptoms: next })
      return next
    })
  }, [debouncedSave])

  const handleDyspareuniaToggle = useCallback(() => {
    const next = !dyspareunia
    setDyspareunia(next)
    debouncedSave({ dyspareunia: next, dyspareunia_intensity: next ? dyspareuniaIntensity : null })
  }, [dyspareunia, dyspareuniaIntensity, debouncedSave])

  const handleDyspareuniaIntensity = useCallback((val: number) => {
    setDyspareuniaIntensity(val)
    debouncedSave({ dyspareunia_intensity: val })
  }, [debouncedSave])

  const handleClotsToggle = useCallback(() => {
    const next = !clotsPresent
    setClotsPresent(next)
    debouncedSave({
      clots_present: next,
      clot_size: next ? clotSize : null,
      clot_count: next ? clotCount : null,
    })
  }, [clotsPresent, clotSize, clotCount, debouncedSave])

  const handleClotSize = useCallback((size: ClotSize) => {
    setClotSize(size)
    debouncedSave({ clot_size: size })
  }, [debouncedSave])

  const handleClotCount = useCallback((count: number | null) => {
    setClotCount(count)
    debouncedSave({ clot_count: count })
  }, [debouncedSave])

  const handleNotes = useCallback((text: string) => {
    setNotes(text)
    debouncedSave({ endo_notes: text })
  }, [debouncedSave])

  return (
    <div
      className="rounded-xl p-4 space-y-4"
      style={{
        background: 'linear-gradient(180deg, #FCEFEB 0%, #FAFAF7 60%)',
        border: '1px solid #E8B5A6',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full"
               style={{ background: '#D4766B' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">
              <path d="M12 2C8 6 8 10 12 14C16 10 16 6 12 2zM12 14C8 18 8 22 12 22C16 22 16 18 12 14z" />
            </svg>
          </div>
          <h4 className="text-[13px] font-semibold uppercase tracking-wide"
              style={{ color: '#8A2A27', letterSpacing: '0.04em' }}>
            Endometriosis Mode
          </h4>
        </div>
        <SaveIndicator show={saved} />
      </div>

      <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
        Additional tracking for clinical reports and pattern detection.
      </p>

      {/* Bowel symptoms */}
      <div className="space-y-2">
        <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          Bowel symptoms
        </p>
        <div className="flex flex-wrap gap-1.5">
          {BOWEL_SYMPTOMS.map(sym => {
            const active = bowelSymptoms.includes(sym.value)
            return (
              <button
                key={sym.value}
                type="button"
                onClick={() => toggleBowelSymptom(sym.value)}
                aria-pressed={active}
                className="rounded-full px-3 py-1.5 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-1"
                style={{
                  background: active ? '#D4766B' : 'var(--bg-card)',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  border: active ? '1px solid #D4766B' : '1px solid var(--border-light)',
                  minHeight: 32,
                }}
              >
                {sym.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Bladder symptoms */}
      <div className="space-y-2">
        <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          Bladder symptoms
        </p>
        <div className="flex flex-wrap gap-1.5">
          {BLADDER_SYMPTOMS.map(sym => {
            const active = bladderSymptoms.includes(sym.value)
            return (
              <button
                key={sym.value}
                type="button"
                onClick={() => toggleBladderSymptom(sym.value)}
                aria-pressed={active}
                className="rounded-full px-3 py-1.5 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-1"
                style={{
                  background: active ? '#D4766B' : 'var(--bg-card)',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  border: active ? '1px solid #D4766B' : '1px solid var(--border-light)',
                  minHeight: 32,
                }}
              >
                {sym.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Dyspareunia */}
      <div className="space-y-2 pt-2" style={{ borderTop: '1px solid #F0DDD5' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Painful intercourse (dyspareunia)
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Deep pain characteristic of endometriosis
            </p>
          </div>
          <button
            type="button"
            onClick={handleDyspareuniaToggle}
            aria-pressed={dyspareunia}
            className="relative w-10 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1"
            style={{ background: dyspareunia ? '#D4766B' : 'var(--border-medium)' }}
          >
            <div
              className="absolute top-1 w-4 h-4 rounded-full bg-white transition-transform"
              style={{ transform: dyspareunia ? 'translateX(20px)' : 'translateX(4px)' }}
            />
          </button>
        </div>
        {dyspareunia && (
          <div>
            <p className="text-[10px] mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Intensity: {dyspareuniaIntensity}/10
            </p>
            <div className="flex justify-between gap-1" role="radiogroup"
                 aria-label="Dyspareunia intensity">
              {Array.from({ length: 10 }, (_, i) => i + 1).map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleDyspareuniaIntensity(val)}
                  role="radio"
                  aria-checked={val === dyspareuniaIntensity}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-1"
                  style={{
                    background: val === dyspareuniaIntensity ? '#D4766B' : 'var(--bg-card)',
                    color: val === dyspareuniaIntensity ? '#fff' : 'var(--text-secondary)',
                    minWidth: 28,
                    minHeight: 28,
                  }}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Clots */}
      <div className="space-y-2 pt-2" style={{ borderTop: '1px solid #F0DDD5' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Blood clots
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Clots larger than a quarter indicate heavy menstrual bleeding
            </p>
          </div>
          <button
            type="button"
            onClick={handleClotsToggle}
            aria-pressed={clotsPresent}
            className="relative w-10 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1"
            style={{ background: clotsPresent ? '#D4766B' : 'var(--border-medium)' }}
          >
            <div
              className="absolute top-1 w-4 h-4 rounded-full bg-white transition-transform"
              style={{ transform: clotsPresent ? 'translateX(20px)' : 'translateX(4px)' }}
            />
          </button>
        </div>
        {clotsPresent && (
          <div className="space-y-3">
            <div>
              <p className="text-[10px] mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Largest clot size today
              </p>
              <div className="grid grid-cols-2 gap-2">
                {CLOT_SIZES.map(cs => {
                  const active = clotSize === cs.value
                  return (
                    <button
                      key={cs.value}
                      type="button"
                      onClick={() => handleClotSize(cs.value)}
                      className="rounded-lg p-2 text-left transition-all focus:outline-none focus:ring-2 focus:ring-offset-1"
                      style={{
                        background: active ? '#D4766B' : 'var(--bg-card)',
                        color: active ? '#fff' : 'var(--text-primary)',
                        border: active ? '1px solid #D4766B' : '1px solid var(--border-light)',
                      }}
                    >
                      <p className="text-xs font-semibold">{cs.label}</p>
                      <p className="text-[10px]" style={{
                        color: active ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)',
                      }}>
                        {cs.reference}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <p className="text-[10px] mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Approximate count (today)
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleClotCount(Math.max(0, (clotCount ?? 0) - 1))}
                  className="h-8 w-8 rounded-full font-bold text-base focus:outline-none focus:ring-2 focus:ring-offset-1"
                  style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)',
                           border: '1px solid var(--border-light)' }}
                  aria-label="Decrease clot count"
                >
                  &minus;
                </button>
                <span className="text-lg font-bold tabular-nums min-w-[2rem] text-center"
                      style={{ color: 'var(--text-primary)' }}>
                  {clotCount ?? 0}
                </span>
                <button
                  type="button"
                  onClick={() => handleClotCount((clotCount ?? 0) + 1)}
                  className="h-8 w-8 rounded-full font-bold text-base focus:outline-none focus:ring-2 focus:ring-offset-1"
                  style={{ background: '#D4766B', color: '#fff' }}
                  aria-label="Increase clot count"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-1 pt-2" style={{ borderTop: '1px solid #F0DDD5' }}>
        <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          Additional notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => handleNotes(e.target.value)}
          placeholder="Flare triggers, procedures, new symptoms..."
          rows={2}
          className="w-full rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            color: 'var(--text-primary)',
          }}
        />
      </div>
    </div>
  )
}
