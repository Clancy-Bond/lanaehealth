'use client'

/*
 * OrthostaticLogForm
 *
 * Six-section log form for a single orthostatic (active-stand) test. The
 * form intentionally takes its time : accurate resting numbers are the
 * load-bearing part of the POTS workup, and a too-fast UI leads to
 * guessed data. Sections in fixed order:
 *
 *   1. When                       (date + time)
 *   2. Resting (lying down)       (HR + BP)
 *   3. Standing HR                (1, 3, 5, 10 min)
 *   4. Standing BP at 10 min
 *   5. Context                    (symptoms, hydration, caffeine)
 *   6. Notes
 *
 * Submission posts form-data to /api/orthostatic/tests. Empty numeric
 * fields are omitted entirely so the server's `intOrNull` returns null
 * rather than coercing "" to 0. Empty strings on textareas are likewise
 * skipped so the strOrNull trim path stores NULL, not "".
 *
 * Because this form takes 5+ minutes to fill, we guard the window with a
 * beforeunload listener that fires only while isDirty is true. The flag
 * flips on first edit and clears after a successful save.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Button, Banner } from '@/v2/components/primitives'
import {
  fieldInputStyle,
  fieldTextareaStyle,
} from '@/app/v2/_tail-shared/formField'
import FormField from './FormField'

interface FormState {
  test_date: string
  test_time: string
  resting_hr_bpm: string
  resting_bp_systolic: string
  resting_bp_diastolic: string
  standing_hr_1min: string
  standing_hr_3min: string
  standing_hr_5min: string
  standing_hr_10min: string
  standing_bp_systolic_10min: string
  standing_bp_diastolic_10min: string
  symptoms_experienced: string
  hydration_ml: string
  caffeine_mg: string
  notes: string
}

function initialState(): FormState {
  const now = new Date()
  return {
    test_date: format(now, 'yyyy-MM-dd'),
    test_time: format(now, 'HH:mm'),
    resting_hr_bpm: '',
    resting_bp_systolic: '',
    resting_bp_diastolic: '',
    standing_hr_1min: '',
    standing_hr_3min: '',
    standing_hr_5min: '',
    standing_hr_10min: '',
    standing_bp_systolic_10min: '',
    standing_bp_diastolic_10min: '',
    symptoms_experienced: '',
    hydration_ml: '',
    caffeine_mg: '',
    notes: '',
  }
}

/*
 * Section wrapper. The heading is an eyebrow label sitting above a
 * vertical stack of fields. Sections are separated by --v2-space-6 via
 * the parent form's gap.
 */
function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-4)',
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-xs)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--v2-tracking-wide)',
          color: 'var(--v2-text-muted)',
          fontWeight: 'var(--v2-weight-semibold)',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

/*
 * Two-column responsive grid for paired inputs (date/time, systolic/
 * diastolic). Collapses to a single column under 360px.
 */
function Pair({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 'var(--v2-space-3)',
      }}
    >
      {children}
    </div>
  )
}

export default function OrthostaticLogForm() {
  const [form, setForm] = useState<FormState>(initialState)
  const [isDirty, setIsDirty] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  /*
   * beforeunload guard: only fires when the form has been touched.
   * Browsers show a generic confirm dialog; the returnValue assignment
   * is required for Chrome/Safari even though the string isn't shown.
   */
  useEffect(() => {
    if (!isDirty) return
    function beforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [isDirty])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (!isDirty) setIsDirty(true)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const fd = new FormData()
      // Required by the API. Always send.
      fd.set('test_date', form.test_date)
      if (form.test_time) fd.set('test_time', form.test_time)
      // Include numeric/text fields only when populated. The server's
      // intOrNull/strOrNull helpers treat missing keys the same as
      // empty strings, so this just avoids sending empty noise.
      const optional: (keyof FormState)[] = [
        'resting_hr_bpm',
        'resting_bp_systolic',
        'resting_bp_diastolic',
        'standing_hr_1min',
        'standing_hr_3min',
        'standing_hr_5min',
        'standing_hr_10min',
        'standing_bp_systolic_10min',
        'standing_bp_diastolic_10min',
        'symptoms_experienced',
        'hydration_ml',
        'caffeine_mg',
        'notes',
      ]
      for (const key of optional) {
        const v = form[key]
        if (typeof v === 'string' && v.trim().length > 0) {
          fd.set(key, v.trim())
        }
      }

      const res = await fetch('/api/orthostatic/tests', {
        method: 'POST',
        body: fd,
      })

      if (res.ok) {
        // Clear dirty flag so the beforeunload guard does not fire
        // during the router.push navigation.
        setIsDirty(false)
        router.push('/v2/topics/orthostatic')
        return
      }

      // Try to extract the server's error message; fall back to a
      // status-based string if the body isn't JSON.
      let message = `Could not save test (${res.status}).`
      try {
        const body = (await res.json()) as { error?: string }
        if (body && typeof body.error === 'string' && body.error.length > 0) {
          message = body.error
        }
      } catch {
        /* non-JSON body, keep the fallback */
      }
      setError(message)
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    router.push('/v2/topics/orthostatic')
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-6)',
        paddingBottom: 'var(--v2-space-10)',
      }}
    >
      <Section title="When">
        <Pair>
          <FormField label="Date">
            <input
              type="date"
              value={form.test_date}
              onChange={(e) => update('test_date', e.target.value)}
              required
              style={fieldInputStyle}
            />
          </FormField>
          <FormField label="Time">
            <input
              type="time"
              value={form.test_time}
              onChange={(e) => update('test_time', e.target.value)}
              style={fieldInputStyle}
            />
          </FormField>
        </Pair>
      </Section>

      <Section title="Resting (lying down)">
        <FormField
          label="Resting heart rate (bpm)"
          hint="Lie down for five minutes before taking this reading."
        >
          <input
            type="number"
            inputMode="numeric"
            min={30}
            max={220}
            step={1}
            value={form.resting_hr_bpm}
            onChange={(e) => update('resting_hr_bpm', e.target.value)}
            required
            style={fieldInputStyle}
          />
        </FormField>
        <Pair>
          <FormField label="Resting BP systolic (mmHg)">
            <input
              type="number"
              inputMode="numeric"
              min={60}
              max={240}
              step={1}
              value={form.resting_bp_systolic}
              onChange={(e) => update('resting_bp_systolic', e.target.value)}
              style={fieldInputStyle}
            />
          </FormField>
          <FormField label="Resting BP diastolic (mmHg)">
            <input
              type="number"
              inputMode="numeric"
              min={30}
              max={150}
              step={1}
              value={form.resting_bp_diastolic}
              onChange={(e) => update('resting_bp_diastolic', e.target.value)}
              style={fieldInputStyle}
            />
          </FormField>
        </Pair>
      </Section>

      <Section title="Standing HR">
        <Pair>
          <FormField label="At 1 min (bpm)">
            <input
              type="number"
              inputMode="numeric"
              min={30}
              max={220}
              step={1}
              value={form.standing_hr_1min}
              onChange={(e) => update('standing_hr_1min', e.target.value)}
              style={fieldInputStyle}
            />
          </FormField>
          <FormField label="At 3 min (bpm)">
            <input
              type="number"
              inputMode="numeric"
              min={30}
              max={220}
              step={1}
              value={form.standing_hr_3min}
              onChange={(e) => update('standing_hr_3min', e.target.value)}
              style={fieldInputStyle}
            />
          </FormField>
          <FormField label="At 5 min (bpm)">
            <input
              type="number"
              inputMode="numeric"
              min={30}
              max={220}
              step={1}
              value={form.standing_hr_5min}
              onChange={(e) => update('standing_hr_5min', e.target.value)}
              style={fieldInputStyle}
            />
          </FormField>
          <FormField label="At 10 min (bpm)">
            <input
              type="number"
              inputMode="numeric"
              min={30}
              max={220}
              step={1}
              value={form.standing_hr_10min}
              onChange={(e) => update('standing_hr_10min', e.target.value)}
              style={fieldInputStyle}
            />
          </FormField>
        </Pair>
      </Section>

      <Section title="Standing BP at 10 min">
        <Pair>
          <FormField label="Systolic (mmHg)">
            <input
              type="number"
              inputMode="numeric"
              min={60}
              max={240}
              step={1}
              value={form.standing_bp_systolic_10min}
              onChange={(e) =>
                update('standing_bp_systolic_10min', e.target.value)
              }
              style={fieldInputStyle}
            />
          </FormField>
          <FormField label="Diastolic (mmHg)">
            <input
              type="number"
              inputMode="numeric"
              min={30}
              max={150}
              step={1}
              value={form.standing_bp_diastolic_10min}
              onChange={(e) =>
                update('standing_bp_diastolic_10min', e.target.value)
              }
              style={fieldInputStyle}
            />
          </FormField>
        </Pair>
      </Section>

      <Section title="Context">
        <FormField label="Symptoms experienced">
          <textarea
            value={form.symptoms_experienced}
            onChange={(e) => update('symptoms_experienced', e.target.value)}
            rows={3}
            placeholder="Lightheaded, palpitations, blurry vision, nausea..."
            style={fieldTextareaStyle}
          />
        </FormField>
        <Pair>
          <FormField label="Hydration in last 2 hours (ml)">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={5000}
              step={1}
              value={form.hydration_ml}
              onChange={(e) => update('hydration_ml', e.target.value)}
              style={fieldInputStyle}
            />
          </FormField>
          <FormField label="Caffeine in last 2 hours (mg)">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={600}
              step={1}
              value={form.caffeine_mg}
              onChange={(e) => update('caffeine_mg', e.target.value)}
              style={fieldInputStyle}
            />
          </FormField>
        </Pair>
      </Section>

      <Section title="Notes">
        <FormField label="Anything else worth remembering">
          <textarea
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            rows={4}
            placeholder="Recent illness, medication changes, exertion before the test..."
            style={fieldTextareaStyle}
          />
        </FormField>
      </Section>

      {error && (
        <Banner
          intent="danger"
          title="Could not save"
          body={error}
        />
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-3)',
        }}
      >
        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          disabled={submitting}
        >
          {submitting ? 'Saving...' : 'Save test'}
        </Button>
        <Button
          type="button"
          variant="tertiary"
          size="md"
          fullWidth
          onClick={handleCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
