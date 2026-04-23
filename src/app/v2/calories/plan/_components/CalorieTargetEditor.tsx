'use client'

/*
 * CalorieTargetEditor
 *
 * Single number input for the daily calorie target plus a live helper
 * line that decomposes the target into kcal-per-macro using MFN's
 * default 45/20/35 split. The small ProgressBar below contextualizes
 * the target against a 2,000 kcal FDA reference, purely visual.
 */

import ProgressBar from '../../_components/ProgressBar'

const FDA_REFERENCE = 2000

export interface CalorieTargetEditorProps {
  value: number
  onChange: (value: number) => void
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

export default function CalorieTargetEditor({ value, onChange }: CalorieTargetEditorProps) {
  const carbsKcal = Math.round(value * 0.45)
  const proteinKcal = Math.round(value * 0.2)
  const fatKcal = Math.round(value * 0.35)
  const safeValue = Number.isFinite(value) && value > 0 ? value : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
        <span style={labelStyle}>Daily calorie target</span>
        <input
          type="number"
          name="calorieTarget"
          required
          min={800}
          max={5000}
          step={1}
          inputMode="numeric"
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => {
            const next = Number(e.target.value)
            onChange(Number.isFinite(next) ? next : 0)
          }}
          style={inputStyle}
        />
      </label>
      <p
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-sm)',
          color: 'var(--v2-text-secondary)',
          lineHeight: 'var(--v2-leading-relaxed)',
        }}
      >
        At {safeValue.toLocaleString()} cal, that&apos;s about {carbsKcal.toLocaleString()} cal carbs,{' '}
        {proteinKcal.toLocaleString()} cal protein, {fatKcal.toLocaleString()} cal fat.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-1)' }}>
        <ProgressBar
          value={safeValue}
          max={FDA_REFERENCE}
          ariaLabel="Calorie target vs 2,000 kcal reference"
        />
        <span
          style={{
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          vs 2,000 cal reference
        </span>
      </div>
    </div>
  )
}
