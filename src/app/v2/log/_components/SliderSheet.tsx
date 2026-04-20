'use client'

/**
 * SliderSheet
 *
 * Reusable focused sheet for any 0-10 slider field on the daily log
 * (pain, fatigue, stress, sleep quality). Sliders render with a
 * color-scale readout and a severity label so the reader gets
 * feedback before they save.
 *
 * Persistence goes through @/lib/api/logs.updateDailyLog, the same
 * endpoint the legacy log uses, so writes land in exactly the same
 * row no matter which surface wrote them.
 */
import { useState, useTransition } from 'react'
import { updateDailyLog } from '@/lib/api/logs'
import type { DailyLog } from '@/lib/types'
import { Sheet, Button } from '@/v2/components/primitives'

export type SliderField = 'overall_pain' | 'fatigue' | 'stress' | 'sleep_quality'

export interface SliderSheetProps {
  open: boolean
  onClose: () => void
  logId: string
  field: SliderField
  initial: number | null
  title: string
  lowLabel: string
  highLabel: string
  /** Map 0-10 to a descriptive word shown under the slider. */
  severityLabel: (value: number) => string
  /** Map 0-10 to a color token for the numeric readout. */
  severityColor: (value: number) => string
  onSaved: (log: DailyLog) => void
}

export default function SliderSheet({
  open,
  onClose,
  logId,
  field,
  initial,
  title,
  lowLabel,
  highLabel,
  severityLabel,
  severityColor,
  onSaved,
}: SliderSheetProps) {
  const [value, setValue] = useState<number>(initial ?? 5)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSave = () => {
    setError(null)
    startTransition(async () => {
      try {
        const updated = await updateDailyLog(logId, { [field]: value } as Partial<DailyLog>)
        onSaved(updated)
        onClose()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save. Try again in a moment.')
      }
    })
  }

  const handleClear = () => {
    setError(null)
    startTransition(async () => {
      try {
        const updated = await updateDailyLog(logId, { [field]: null } as Partial<DailyLog>)
        onSaved(updated)
        onClose()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not clear. Try again in a moment.')
      }
    })
  }

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--v2-space-2)' }}>
          <span
            style={{
              fontSize: 'var(--v2-text-3xl)',
              fontWeight: 'var(--v2-weight-bold)',
              color: severityColor(value),
              letterSpacing: 'var(--v2-tracking-tight)',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}
          >
            {value}
          </span>
          <span style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)' }}>
            {severityLabel(value)}
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          aria-label={title}
          style={{
            width: '100%',
            accentColor: severityColor(value),
            minHeight: 'var(--v2-touch-target-min)',
          }}
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--v2-tracking-wide)',
          }}
        >
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>

        {error && (
          <p
            role="alert"
            style={{ margin: 0, fontSize: 'var(--v2-text-sm)', color: 'var(--v2-accent-danger)' }}
          >
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 'var(--v2-space-2)', flexDirection: 'column' }}>
          <Button variant="primary" onClick={handleSave} disabled={isPending} fullWidth>
            {isPending ? 'Saving...' : 'Save'}
          </Button>
          {initial != null && (
            <Button variant="tertiary" onClick={handleClear} disabled={isPending} fullWidth>
              Clear today's value
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  )
}

/*
 * LEARNING-MODE HOOK L1: Severity label copy.
 *
 * The PAIN_LABELS below are user-facing words tied to 0-10. The
 * default leans clinical ("None / Mild / Moderate / Severe / Extreme").
 * A gentler register might read "Comfortable / Noticeable / Pulling /
 * Hard / Overwhelming". Swap either set across all screens that
 * quote pain so the vocabulary stays consistent.
 */
export function painSeverityLabel(v: number): string {
  if (v === 0) return 'None'
  if (v <= 2) return 'Mild'
  if (v <= 4) return 'Moderate'
  if (v <= 6) return 'Severe'
  if (v <= 8) return 'Very severe'
  return 'Extreme'
}
export function painSeverityColor(v: number): string {
  if (v === 0) return 'var(--v2-accent-success)'
  if (v <= 3) return 'var(--v2-accent-primary)'
  if (v <= 6) return 'var(--v2-accent-highlight)'
  if (v <= 8) return 'var(--v2-accent-warning)'
  return 'var(--v2-accent-danger)'
}

export function fatigueSeverityLabel(v: number): string {
  if (v >= 9) return 'Great energy'
  if (v >= 7) return 'Good energy'
  if (v >= 5) return 'Moderate'
  if (v >= 3) return 'Low energy'
  if (v >= 1) return 'Very low'
  return 'Exhausted'
}
export function fatigueSeverityColor(v: number): string {
  if (v >= 8) return 'var(--v2-accent-success)'
  if (v >= 6) return 'var(--v2-accent-primary)'
  if (v >= 4) return 'var(--v2-accent-highlight)'
  if (v >= 2) return 'var(--v2-accent-warning)'
  return 'var(--v2-accent-danger)'
}

export function stressSeverityLabel(v: number): string {
  if (v === 0) return 'Calm'
  if (v <= 2) return 'Gentle'
  if (v <= 4) return 'Moderate'
  if (v <= 6) return 'High'
  if (v <= 8) return 'Very high'
  return 'Overwhelming'
}

export function sleepQualityLabel(v: number): string {
  if (v >= 9) return 'Restorative'
  if (v >= 7) return 'Good'
  if (v >= 5) return 'Fair'
  if (v >= 3) return 'Broken'
  if (v >= 1) return 'Poor'
  return 'Awful'
}
