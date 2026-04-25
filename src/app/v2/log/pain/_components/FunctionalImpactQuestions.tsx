'use client'

/**
 * FunctionalImpactQuestions
 *
 * Two PEG-style sliders capturing how today's pain interferes with
 * function. The "intensity" P-item of PEG is already covered by the
 * canonical NRS / FACES selection at the top of the form, so we only
 * render the E (enjoyment of life) and G (general activity) items
 * here to avoid asking the user to rate intensity twice.
 *
 * Source: Krebs EE et al. (2009). "Development and Initial Validation
 * of the PEG, a Three-item Scale Assessing Pain Intensity and
 * Interference." J Gen Intern Med 24(6):733-738. PEG was validated
 * against the Brief Pain Inventory interference subscale (Cleeland CS
 * & Ryan KM, 1994) with rho 0.60-0.95 and is in routine use across
 * the VA / HHS for chronic pain monitoring.
 *
 * Both sliders read 0 (does not interfere at all) to 10 (interferes
 * completely).
 */
import { useId } from 'react'

export interface PegValues {
  enjoyment: number
  activity: number
}

export interface FunctionalImpactQuestionsProps {
  values: PegValues
  onChange: (next: PegValues) => void
}

interface PegSliderProps {
  label: string
  hint: string
  value: number
  onChange: (v: number) => void
}

function PegSlider({ label, hint, value, onChange }: PegSliderProps) {
  const id = useId()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
      <label
        htmlFor={id}
        style={{
          fontSize: 'var(--v2-text-sm)',
          fontWeight: 'var(--v2-weight-medium)',
          color: 'var(--v2-text-primary)',
        }}
      >
        {label}
      </label>
      <p
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-text-muted)',
        }}
      >
        {hint}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--v2-space-3)' }}>
        <input
          id={id}
          type="range"
          min={0}
          max={10}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-valuemin={0}
          aria-valuemax={10}
          aria-valuenow={value}
          style={{
            flex: 1,
            minHeight: 'var(--v2-touch-target-min)',
            accentColor: 'var(--v2-accent-primary)',
          }}
        />
        <span
          style={{
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 'var(--v2-weight-bold)',
            color: 'var(--v2-text-primary)',
            minWidth: 28,
            textAlign: 'right',
          }}
        >
          {value}
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-text-muted)',
        }}
      >
        <span>Not at all</span>
        <span>Completely</span>
      </div>
    </div>
  )
}

export default function FunctionalImpactQuestions({ values, onChange }: FunctionalImpactQuestionsProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
      <PegSlider
        label="Enjoyment of life"
        hint="How much has pain gotten in the way of enjoying things today?"
        value={values.enjoyment}
        onChange={(enjoyment) => onChange({ ...values, enjoyment })}
      />
      <PegSlider
        label="General activity"
        hint="How much has pain interfered with what you wanted to get done today?"
        value={values.activity}
        onChange={(activity) => onChange({ ...values, activity })}
      />
    </div>
  )
}
