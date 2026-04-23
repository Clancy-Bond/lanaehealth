'use client'

/*
 * WeightPlanEditor
 *
 * Lanae is US-based, so the unit toggle defaults to lb. Internally
 * everything stays in kg (the API + DB shape). The visible inputs
 * round to 1 decimal in the chosen unit so flipping the toggle
 * doesn't churn precision. The weekly-rate label is read-only and
 * computed from current/target/date delta with NC-voice phrasing.
 */

import { useMemo } from 'react'
import { SegmentedControl } from '@/v2/components/primitives'
import { kgToLb, lbToKg } from '@/lib/calories/weight'

export type WeightUnit = 'lb' | 'kg'

export interface WeightPlanValues {
  currentKg: number | null
  targetKg: number | null
  targetDate: string | null
}

export interface WeightPlanEditorProps {
  values: WeightPlanValues
  unit: WeightUnit
  onUnitChange: (next: WeightUnit) => void
  onChange: (next: WeightPlanValues) => void
}

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--v2-text-xs)',
  color: 'var(--v2-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: 'var(--v2-tracking-wide)',
}

const inputStyle: React.CSSProperties = {
  minHeight: 'var(--v2-touch-target-min)',
  padding: 'var(--v2-space-3) var(--v2-space-4)',
  borderRadius: 'var(--v2-radius-md)',
  background: 'var(--v2-bg-card)',
  color: 'var(--v2-text-primary)',
  border: '1px solid var(--v2-border-strong)',
  fontSize: 'var(--v2-text-base)',
  fontFamily: 'inherit',
  width: '100%',
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function displayInUnit(kg: number | null, unit: WeightUnit): string {
  if (kg == null || !Number.isFinite(kg)) return ''
  const out = unit === 'lb' ? kgToLb(kg) : kg
  return String(round1(out))
}

function parseToKg(input: string, unit: WeightUnit): number | null {
  if (input.trim() === '') return null
  const n = Number(input)
  if (!Number.isFinite(n)) return null
  return unit === 'lb' ? lbToKg(n) : n
}

function daysBetween(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + 'T00:00:00').getTime()
  const b = new Date(toISO + 'T00:00:00').getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.max(0, Math.round((b - a) / 86400000))
}

function rateCopy(lbPerWeek: number): string {
  const abs = Math.abs(lbPerWeek)
  if (abs < 0.1) return 'Holding steady.'
  if (abs <= 0.6) return 'A gentle pace.'
  if (abs <= 1.2) return 'Steady progress.'
  if (abs <= 2) return 'A brisk pace. Listen to your body.'
  return 'Steep. Double-check with your doctor if it stays above 2 lb per week.'
}

export default function WeightPlanEditor({
  values,
  unit,
  onUnitChange,
  onChange,
}: WeightPlanEditorProps) {
  const todayISO = useMemo(() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }, [])

  const weeklyRate = useMemo(() => {
    if (values.currentKg == null || values.targetKg == null || !values.targetDate) return null
    const days = daysBetween(todayISO, values.targetDate)
    if (days <= 0) return null
    const deltaKg = values.targetKg - values.currentKg
    const lbPerWeek = (kgToLb(deltaKg) / days) * 7
    return lbPerWeek
  }, [values.currentKg, values.targetKg, values.targetDate, todayISO])

  const update = (patch: Partial<WeightPlanValues>) => onChange({ ...values, ...patch })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <SegmentedControl<WeightUnit>
          segments={[
            { value: 'lb', label: 'lb' },
            { value: 'kg', label: 'kg' },
          ]}
          value={unit}
          onChange={onUnitChange}
        />
      </div>

      {/* Inputs read in the user's unit but state stores kg. The parent
          form submits state directly via fetch, so `name` isn't used by
          native form encoding. */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
        <span style={labelStyle}>Current weight ({unit})</span>
        <input
          type="number"
          min={0}
          max={unit === 'lb' ? 880 : 400}
          step={0.1}
          inputMode="decimal"
          value={displayInUnit(values.currentKg, unit)}
          onChange={(e) => update({ currentKg: parseToKg(e.target.value, unit) })}
          style={inputStyle}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
        <span style={labelStyle}>Target weight ({unit})</span>
        <input
          type="number"
          min={0}
          max={unit === 'lb' ? 880 : 400}
          step={0.1}
          inputMode="decimal"
          value={displayInUnit(values.targetKg, unit)}
          onChange={(e) => update({ targetKg: parseToKg(e.target.value, unit) })}
          style={inputStyle}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
        <span style={labelStyle}>Target date</span>
        <input
          type="date"
          min={todayISO}
          value={values.targetDate ?? ''}
          onChange={(e) => update({ targetDate: e.target.value || null })}
          style={inputStyle}
        />
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-1)' }}>
        <span style={labelStyle}>Weekly rate</span>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-base)',
            color: 'var(--v2-text-primary)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {weeklyRate == null
            ? 'Add current, target, and a date to see your pace.'
            : `${formatRate(weeklyRate)} per week. ${rateCopy(weeklyRate)}`}
        </p>
      </div>
    </div>
  )
}

function formatRate(lbPerWeek: number): string {
  const sign = lbPerWeek < 0 ? '-' : '+'
  return `${sign}${Math.abs(lbPerWeek).toFixed(1)} lb`
}
