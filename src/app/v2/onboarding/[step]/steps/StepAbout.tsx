'use client'

/**
 * Step 2: About you
 *
 * Captures the basics that downstream features depend on:
 *   - First name (drives greetings)
 *   - Date of birth (age math for cycle algorithms + lab reference ranges)
 *   - Sex (cycle, BMR, body composition formulas)
 *   - Height + weight (BMI, calorie targets, dose-by-weight medications)
 *   - Timezone (so "today" matches the user's local day, not UTC)
 *
 * Pre-fills from the loaded draft when the user has already answered
 * before. Validation stays kind: we accept blank fields rather than
 * blocking, since the wizard's promise is "skip-able at every step".
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card } from '@/v2/components/primitives'
import OnboardingShell from '../../_components/OnboardingShell'
import { STEP_TITLES } from './config'
import type { StepNumber } from './config'
import type { PersonalDraft } from './load-draft'

interface StepAboutProps {
  step: StepNumber
  totalSteps: number
  initial: PersonalDraft | null
  revise?: boolean
}

const SEX_OPTIONS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'intersex', label: 'Intersex' },
  { value: 'prefer_not', label: 'Prefer not to say' },
] as const

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

function ageFromDob(dob: string): number | undefined {
  if (!dob) return undefined
  const d = new Date(dob + 'T00:00:00Z')
  if (Number.isNaN(d.getTime())) return undefined
  const now = new Date()
  let age = now.getUTCFullYear() - d.getUTCFullYear()
  const beforeBirthday =
    now.getUTCMonth() < d.getUTCMonth() ||
    (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() < d.getUTCDate())
  if (beforeBirthday) age -= 1
  return Math.max(0, age)
}

export default function StepAbout({ step, totalSteps, initial, revise = false }: StepAboutProps) {
  const router = useRouter()
  const titleCfg = STEP_TITLES[step]
  const nextSuffix = revise ? '?revise=true' : ''

  const [fullName, setFullName] = useState(initial?.full_name ?? '')
  const [dob, setDob] = useState(initial?.date_of_birth ?? '')
  const [sex, setSex] = useState(initial?.sex ?? '')
  const [heightCm, setHeightCm] = useState<string>(
    initial?.height_cm ? String(initial.height_cm) : '',
  )
  const [weightKg, setWeightKg] = useState<string>(
    initial?.weight_kg ? String(initial.weight_kg) : '',
  )
  const [timezone, setTimezone] = useState<string>(initial?.timezone ?? detectTimezone())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onContinue() {
    setSaving(true)
    setError(null)
    const payload: Record<string, unknown> = { timezone }
    if (fullName.trim()) payload.full_name = fullName.trim()
    if (dob) {
      payload.date_of_birth = dob
      const age = ageFromDob(dob)
      if (age !== undefined) payload.age = age
    }
    if (sex) payload.sex = sex
    const h = Number(heightCm)
    if (Number.isFinite(h) && h >= 50 && h <= 280) payload.height_cm = h
    const w = Number(weightKg)
    if (Number.isFinite(w) && w >= 20 && w <= 400) payload.weight_kg = w

    try {
      const res = await fetch('/api/v2/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ step: 'personal', data: payload }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? 'Save failed. Try again in a moment.')
        setSaving(false)
        return
      }
      router.push(`/v2/onboarding/3${nextSuffix}`)
    } catch {
      setError('Network hiccup. Check your connection and try again.')
      setSaving(false)
    }
  }

  return (
    <OnboardingShell
      step={step}
      totalSteps={totalSteps}
      title={titleCfg.title}
      subtitle={titleCfg.subtitle}
      revise={revise}
      primaryAction={
        <Button variant="primary" size="lg" fullWidth onClick={onContinue} disabled={saving}>
          {saving ? 'Saving' + '…' : 'Continue'}
        </Button>
      }
    >
      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void onContinue()
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}
        >
          <Field
            label="First name"
            type="text"
            value={fullName}
            onChange={setFullName}
            placeholder="What should we call you?"
            autoComplete="given-name"
          />
          <Field
            label="Date of birth"
            type="date"
            value={dob}
            onChange={setDob}
            autoComplete="bday"
          />
          <SelectField label="Sex" value={sex} onChange={setSex} options={SEX_OPTIONS} />
          <div style={{ display: 'flex', gap: 'var(--v2-space-3)' }}>
            <div style={{ flex: 1 }}>
              <Field
                label="Height (cm)"
                type="number"
                value={heightCm}
                onChange={setHeightCm}
                placeholder="e.g. 170"
                inputMode="decimal"
              />
            </div>
            <div style={{ flex: 1 }}>
              <Field
                label="Weight (kg)"
                type="number"
                value={weightKg}
                onChange={setWeightKg}
                placeholder="e.g. 65"
                inputMode="decimal"
              />
            </div>
          </div>
          <Field
            label="Timezone"
            type="text"
            value={timezone}
            onChange={setTimezone}
            placeholder="e.g. Pacific/Honolulu"
          />
          {error && (
            <p
              role="alert"
              style={{ margin: 0, color: 'var(--v2-accent-danger)', fontSize: 'var(--v2-text-sm)' }}
            >
              {error}
            </p>
          )}
        </form>
      </Card>
    </OnboardingShell>
  )
}

interface FieldProps {
  label: string
  type: 'text' | 'date' | 'number'
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'email' | 'url' | 'search' | 'none'
}

function Field({ label, type, value, onChange, placeholder, autoComplete, inputMode }: FieldProps) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-1)' }}>
      <span
        style={{
          fontSize: 'var(--v2-text-xs)',
          fontWeight: 'var(--v2-weight-semibold)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--v2-text-muted)',
        }}
      >
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        style={{
          padding: 'var(--v2-space-3)',
          fontSize: 'var(--v2-text-base)',
          borderRadius: 'var(--v2-radius-md)',
          background: 'var(--v2-bg-primary)',
          border: '1px solid var(--v2-border-strong)',
          color: 'var(--v2-text-primary)',
          fontFamily: 'inherit',
        }}
      />
    </label>
  )
}

interface SelectFieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  options: ReadonlyArray<{ value: string; label: string }>
}

function SelectField({ label, value, onChange, options }: SelectFieldProps) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-1)' }}>
      <span
        style={{
          fontSize: 'var(--v2-text-xs)',
          fontWeight: 'var(--v2-weight-semibold)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--v2-text-muted)',
        }}
      >
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: 'var(--v2-space-3)',
          fontSize: 'var(--v2-text-base)',
          borderRadius: 'var(--v2-radius-md)',
          background: 'var(--v2-bg-primary)',
          border: '1px solid var(--v2-border-strong)',
          color: 'var(--v2-text-primary)',
          fontFamily: 'inherit',
        }}
      >
        <option value="">Pick one</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}
