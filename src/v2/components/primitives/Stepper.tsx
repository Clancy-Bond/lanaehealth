'use client'

/*
 * Stepper
 *
 * Increment/decrement control for numeric inputs (e.g. servings,
 * doses, pain level). Three inline buttons with the value between.
 */
import { useState } from 'react'

export interface StepperProps {
  value?: number
  defaultValue?: number
  min?: number
  max?: number
  step?: number
  onChange?: (value: number) => void
  label?: string
  unit?: string
}

export default function Stepper({
  value,
  defaultValue = 0,
  min = 0,
  max = 99,
  step = 1,
  onChange,
  label,
  unit,
}: StepperProps) {
  const [internal, setInternal] = useState(defaultValue)
  const v = value ?? internal

  const set = (next: number) => {
    const clamped = Math.max(min, Math.min(max, next))
    if (value === undefined) setInternal(clamped)
    onChange?.(clamped)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--v2-space-3)' }}>
      {label && (
        <span style={{ flex: 1, fontSize: 'var(--v2-text-base)', color: 'var(--v2-text-primary)' }}>{label}</span>
      )}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          border: '1px solid var(--v2-border)',
          borderRadius: 'var(--v2-radius-full)',
          background: 'var(--v2-bg-card)',
        }}
      >
        <button
          type="button"
          onClick={() => set(v - step)}
          disabled={v <= min}
          aria-label="Decrement"
          style={stepBtn(v <= min)}
        >
          −
        </button>
        <span
          style={{
            minWidth: 48,
            textAlign: 'center',
            fontSize: 'var(--v2-text-base)',
            fontWeight: 'var(--v2-weight-semibold)',
            fontVariantNumeric: 'tabular-nums',
            color: 'var(--v2-text-primary)',
          }}
        >
          {v}
          {unit ? ` ${unit}` : ''}
        </span>
        <button
          type="button"
          onClick={() => set(v + step)}
          disabled={v >= max}
          aria-label="Increment"
          style={stepBtn(v >= max)}
        >
          +
        </button>
      </div>
    </div>
  )
}

function stepBtn(disabled: boolean): React.CSSProperties {
  return {
    width: 44,
    height: 44,
    border: 0,
    background: 'transparent',
    color: disabled ? 'var(--v2-text-muted)' : 'var(--v2-text-primary)',
    fontSize: 20,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
  }
}
