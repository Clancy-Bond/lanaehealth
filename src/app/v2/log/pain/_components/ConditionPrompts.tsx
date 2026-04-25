'use client'

/**
 * ConditionPrompts
 *
 * Renders the condition-aware micro-questions:
 *   - HIT-6 question 1 (severity frequency) when migraine is active
 *     and the user's quality/region selections suggest a head pain
 *     pattern.
 *   - COMPASS-31 orthostatic micro-rating when the user has POTS-like
 *     diagnoses on record and their selections overlap with
 *     orthostatic episodes.
 *
 * Sources:
 *   HIT-6: Kosinski M et al. (2003). "A six-item short-form survey
 *     for measuring headache impact: the HIT-6." Qual Life Res
 *     12(8):963-974. Question 1 ("When you have headaches, how often
 *     is the pain severe?") works as an in-the-moment check.
 *   COMPASS-31: Sletten DM et al. (2012). "COMPASS 31: a refined and
 *     abbreviated Composite Autonomic Symptom Score." Mayo Clin Proc
 *     87(12):1196-1201. We use one ordinal from the orthostatic
 *     intolerance domain for daily logging.
 */
import type {
  Hit6SeverityFrequency,
  CompassOrthostatic,
} from '@/lib/types'

export interface ConditionPromptsProps {
  showMigrainePrompt: boolean
  showOrthostaticPrompt: boolean
  hit6Severity: Hit6SeverityFrequency | undefined
  onHit6SeverityChange: (v: Hit6SeverityFrequency | undefined) => void
  compassOrthostatic: CompassOrthostatic | undefined
  onCompassOrthostaticChange: (v: CompassOrthostatic | undefined) => void
}

const HIT6_OPTIONS: Array<{ value: Hit6SeverityFrequency; label: string }> = [
  { value: 'never', label: 'Never' },
  { value: 'rarely', label: 'Rarely' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'very_often', label: 'Very often' },
  { value: 'always', label: 'Always' },
]

const COMPASS_OPTIONS: Array<{ value: CompassOrthostatic; label: string; sub: string }> = [
  { value: 'none', label: 'None', sub: 'Felt steady' },
  { value: 'mild', label: 'Mild', sub: 'A flicker of light-headed' },
  { value: 'moderate', label: 'Moderate', sub: 'Had to brace or sit' },
  { value: 'severe', label: 'Severe', sub: 'Vision dimmed or near-faint' },
]

function PromptRadioGroup<T extends string>({
  ariaLabel,
  options,
  value,
  onChange,
}: {
  ariaLabel: string
  options: Array<{ value: T; label: string; sub?: string }>
  value: T | undefined
  onChange: (v: T | undefined) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-1)' }}
    >
      {options.map((opt) => {
        const isOn = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isOn}
            onClick={() => onChange(isOn ? undefined : opt.value)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 'var(--v2-space-2)',
              padding: 'var(--v2-space-3) var(--v2-space-4)',
              borderRadius: 'var(--v2-radius-md)',
              border: `1px solid ${isOn ? 'var(--v2-accent-primary)' : 'var(--v2-border)'}`,
              background: isOn ? 'var(--v2-accent-primary-soft)' : 'var(--v2-bg-base)',
              color: 'var(--v2-text-primary)',
              cursor: 'pointer',
              minHeight: 'var(--v2-touch-target-min)',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 'var(--v2-text-sm)', fontWeight: 'var(--v2-weight-medium)' }}>
              {opt.label}
            </span>
            {opt.sub && (
              <span style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)' }}>
                {opt.sub}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default function ConditionPrompts({
  showMigrainePrompt,
  showOrthostaticPrompt,
  hit6Severity,
  onHit6SeverityChange,
  compassOrthostatic,
  onCompassOrthostaticChange,
}: ConditionPromptsProps) {
  if (!showMigrainePrompt && !showOrthostaticPrompt) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-5)' }}>
      {showMigrainePrompt && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
          <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span
              style={{
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--v2-tracking-wide)',
              }}
            >
              Migraine check (HIT-6)
            </span>
            <h3
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-base)',
                fontWeight: 'var(--v2-weight-semibold)',
                color: 'var(--v2-text-primary)',
              }}
            >
              When you have headaches, how often is the pain severe?
            </h3>
          </header>
          <PromptRadioGroup
            ariaLabel="HIT-6 severity frequency"
            options={HIT6_OPTIONS}
            value={hit6Severity}
            onChange={onHit6SeverityChange}
          />
        </section>
      )}

      {showOrthostaticPrompt && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
          <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span
              style={{
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--v2-tracking-wide)',
              }}
            >
              Orthostatic check (COMPASS-31)
            </span>
            <h3
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-base)',
                fontWeight: 'var(--v2-weight-semibold)',
                color: 'var(--v2-text-primary)',
              }}
            >
              Light-headed or dizzy on standing today?
            </h3>
          </header>
          <PromptRadioGroup
            ariaLabel="COMPASS-31 orthostatic intolerance"
            options={COMPASS_OPTIONS}
            value={compassOrthostatic}
            onChange={onCompassOrthostaticChange}
          />
        </section>
      )}
    </div>
  )
}
