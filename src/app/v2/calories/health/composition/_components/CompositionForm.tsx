/*
 * CompositionForm
 *
 * Single-form body composition log. Server action posts a partial
 * BodyMetricsEntry so the user can log just one or two measurements
 * without filling out the whole form. Voice rule: every label is a
 * neutral noun, no "your" or "you should".
 */
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { Button, Card } from '@/v2/components/primitives'
import { addBodyMetricsEntry } from '@/lib/calories/body-metrics-log'
import { lbToKg } from '@/lib/calories/weight'

function inToCm(inches: number): number {
  return inches * 2.54
}

async function logComposition(formData: FormData): Promise<void> {
  'use server'

  function num(name: string): number | null {
    const raw = String(formData.get(name) ?? '').trim()
    if (raw === '') return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }

  const weightLb = num('weight_lb')
  const bodyFatPct = num('body_fat_pct')
  const waistIn = num('waist_in')
  const hipIn = num('hip_in')
  const neckIn = num('neck_in')
  const visceral = num('visceral_fat_rating')
  const muscleLb = num('muscle_lb')
  const bmdT = num('bmd_t_score')
  const notes = String(formData.get('notes') ?? '').trim()

  const date = format(new Date(), 'yyyy-MM-dd')

  const result = await addBodyMetricsEntry({
    date,
    weight_kg: weightLb !== null ? lbToKg(weightLb) : null,
    body_fat_pct: bodyFatPct,
    waist_cm: waistIn !== null ? inToCm(waistIn) : null,
    hip_cm: hipIn !== null ? inToCm(hipIn) : null,
    neck_cm: neckIn !== null ? inToCm(neckIn) : null,
    visceral_fat_rating: visceral,
    muscle_mass_kg: muscleLb !== null ? lbToKg(muscleLb) : null,
    bmd_t_score: bmdT,
    body_fat_method: bodyFatPct !== null
      ? (waistIn !== null && neckIn !== null ? 'navy' : 'bia')
      : null,
    notes: notes || null,
  })

  if (!result.ok) {
    redirect(`/v2/calories/health/composition?error=${encodeURIComponent(result.error ?? 'save')}`)
  }
  redirect('/v2/calories/health/composition?saved=1')
}

interface FieldProps {
  name: string
  label: string
  unit: string
  step: string
  placeholder?: string
}

function Field({ name, label, unit, step, placeholder }: FieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
      <label
        htmlFor={name}
        style={{
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--v2-tracking-wide)',
        }}
      >
        {label}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--v2-space-2)' }}>
        <input
          id={name}
          name={name}
          type="number"
          inputMode="decimal"
          step={step}
          placeholder={placeholder}
          style={{
            flex: 1,
            fontSize: 'var(--v2-text-base)',
            padding: 'var(--v2-space-3) var(--v2-space-4)',
            borderRadius: 'var(--v2-radius-md)',
            background: 'var(--v2-bg-card)',
            color: 'var(--v2-text-primary)',
            border: '1px solid var(--v2-border-subtle)',
          }}
        />
        <span style={{ color: 'var(--v2-text-muted)', fontSize: 'var(--v2-text-sm)' }}>
          {unit}
        </span>
      </div>
    </div>
  )
}

export default function CompositionForm({ error }: { error?: string | null }) {
  return (
    <Card padding="md">
      <form
        action={logComposition}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-4)',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-base)',
            color: 'var(--v2-text-primary)',
          }}
        >
          Log a measurement
        </h2>
        <p
          style={{
            margin: 0,
            color: 'var(--v2-text-muted)',
            fontSize: 'var(--v2-text-sm)',
          }}
        >
          Fill in only what you have today. Each one is optional.
        </p>

        <Field name="weight_lb" label="Weight" unit="lb" step="0.1" placeholder="201.4" />
        <Field name="body_fat_pct" label="Body fat" unit="%" step="0.1" placeholder="28.5" />
        <Field name="waist_in" label="Waist" unit="in" step="0.1" placeholder="32.0" />
        <Field name="hip_in" label="Hip" unit="in" step="0.1" placeholder="40.0" />
        <Field name="neck_in" label="Neck" unit="in" step="0.1" placeholder="13.0" />
        <Field name="visceral_fat_rating" label="Visceral fat (BIA scale)" unit="" step="1" placeholder="6" />
        <Field name="muscle_lb" label="Muscle mass" unit="lb" step="0.1" placeholder="120.0" />
        <Field name="bmd_t_score" label="BMD T-score (DEXA)" unit="" step="0.1" placeholder="-0.5" />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
          <label
            htmlFor="notes"
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--v2-tracking-wide)',
            }}
          >
            Notes (optional)
          </label>
          <input
            id="notes"
            name="notes"
            type="text"
            maxLength={280}
            placeholder="Morning weigh-in, post-shower"
            style={{
              fontSize: 'var(--v2-text-base)',
              padding: 'var(--v2-space-3) var(--v2-space-4)',
              borderRadius: 'var(--v2-radius-md)',
              background: 'var(--v2-bg-card)',
              color: 'var(--v2-text-primary)',
              border: '1px solid var(--v2-border-subtle)',
            }}
          />
        </div>

        {error && (
          <p style={{ color: 'var(--v2-accent-warning)', fontSize: 'var(--v2-text-sm)' }}>
            {error}
          </p>
        )}

        <Button type="submit" variant="primary">
          Save
        </Button>
      </form>
    </Card>
  )
}
