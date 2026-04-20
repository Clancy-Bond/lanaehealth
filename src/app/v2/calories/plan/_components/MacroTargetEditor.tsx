'use client'

/*
 * MacroTargetEditor
 *
 * Three primary macro rows (carbs / protein / fat) plus a collapsible
 * "More" section for fiber, sodium, calcium. The Toggle "Auto-calculate
 * from calories" disables the macro inputs and reflects the live
 * computation from recalcMacrosFromCalories() so the user sees the
 * result before saving. macrosManual writes through a hidden input.
 */

import { useState } from 'react'
import { Toggle } from '@/v2/components/primitives'
import ProgressBar from '../../_components/ProgressBar'

export interface MacroValues {
  carbsG: number
  proteinG: number
  fatG: number
  fiberG: number
  sodiumMg: number
  calciumMg: number
}

export interface MacroTargetEditorProps {
  calorieTarget: number
  values: MacroValues
  manual: boolean
  onChange: (next: MacroValues) => void
  onManualChange: (next: boolean) => void
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

interface MacroSpec {
  field: 'carbsG' | 'proteinG' | 'fatG'
  label: string
  kcalPerG: number
  max: number
  color: string
}

const MACRO_SPECS: MacroSpec[] = [
  { field: 'carbsG', label: 'Carbs (g)', kcalPerG: 4, max: 600, color: 'var(--v2-accent-highlight)' },
  { field: 'proteinG', label: 'Protein (g)', kcalPerG: 4, max: 400, color: 'var(--v2-accent-primary)' },
  { field: 'fatG', label: 'Fat (g)', kcalPerG: 9, max: 300, color: 'var(--v2-accent-orange)' },
]

interface MicroSpec {
  field: 'fiberG' | 'sodiumMg' | 'calciumMg'
  label: string
  unit: string
  max: number
}

const MICRO_SPECS: MicroSpec[] = [
  { field: 'fiberG', label: 'Fiber', unit: 'g', max: 100 },
  { field: 'sodiumMg', label: 'Sodium', unit: 'mg', max: 15000 },
  { field: 'calciumMg', label: 'Calcium', unit: 'mg', max: 3000 },
]

function numberOrZero(s: string): number {
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

export default function MacroTargetEditor({
  calorieTarget,
  values,
  manual,
  onChange,
  onManualChange,
}: MacroTargetEditorProps) {
  const [showMicros, setShowMicros] = useState(false)
  const safeTarget = calorieTarget > 0 ? calorieTarget : 1
  const update = (field: keyof MacroValues, n: number) => onChange({ ...values, [field]: n })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--v2-space-3)',
        }}
      >
        <span style={{ fontSize: 'var(--v2-text-base)', color: 'var(--v2-text-primary)' }}>
          Auto-calculate from calories
        </span>
        <Toggle checked={!manual} onChange={(checked) => onManualChange(!checked)} />
      </div>
      <input type="hidden" name="macrosManual" value={manual ? 'true' : 'false'} />

      {MACRO_SPECS.map((spec) => {
        const v = values[spec.field]
        const kcal = v * spec.kcalPerG
        const pct = Math.round((kcal / safeTarget) * 100)
        const id = `macro-${spec.field}`
        return (
          <div key={spec.field} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--v2-space-3)' }}>
              <label htmlFor={id} style={{ ...labelStyle, flex: 1 }}>{spec.label}</label>
              <span
                style={{
                  fontSize: 'var(--v2-text-xs)',
                  color: 'var(--v2-text-muted)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {pct}%
              </span>
            </div>
            <input
              id={id}
              type="number"
              name={spec.field}
              min={0}
              max={spec.max}
              step={1}
              inputMode="numeric"
              disabled={!manual}
              value={Number.isFinite(v) ? v : ''}
              onChange={(e) => update(spec.field, numberOrZero(e.target.value))}
              style={{ ...inputStyle, opacity: !manual ? 0.6 : 1, cursor: !manual ? 'not-allowed' : 'text' }}
            />
            <ProgressBar
              value={kcal}
              max={safeTarget}
              color={spec.color}
              ariaLabel={`${spec.label} percent of calorie target`}
            />
          </div>
        )
      })}

      <button
        type="button"
        onClick={() => setShowMicros((v) => !v)}
        aria-expanded={showMicros}
        style={{
          alignSelf: 'flex-start',
          background: 'transparent',
          color: 'var(--v2-accent-primary)',
          border: 0,
          padding: 'var(--v2-space-2) 0',
          fontSize: 'var(--v2-text-sm)',
          fontWeight: 'var(--v2-weight-semibold)',
          cursor: 'pointer',
          fontFamily: 'inherit',
          minHeight: 'var(--v2-touch-target-min)',
        }}
      >
        {showMicros ? 'Hide fiber, sodium, calcium' : 'Show fiber, sodium, calcium'}
      </button>

      {showMicros && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
          {MICRO_SPECS.map((spec) => {
            const id = `macro-${spec.field}`
            return (
              <label
                key={spec.field}
                htmlFor={id}
                style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}
              >
                <span style={labelStyle}>{spec.label} ({spec.unit})</span>
                <input
                  id={id}
                  type="number"
                  name={spec.field}
                  min={0}
                  max={spec.max}
                  step={1}
                  inputMode="numeric"
                  value={Number.isFinite(values[spec.field]) ? values[spec.field] : ''}
                  onChange={(e) => update(spec.field, numberOrZero(e.target.value))}
                  style={inputStyle}
                />
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
