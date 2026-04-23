'use client'

/*
 * BPLogForm
 *
 * Light log form for a single blood-pressure reading. POSTs JSON to
 * the existing /api/bp/log route (same API the legacy page uses, via
 * form-encoded submit), then calls router.refresh() so the server
 * components above (latest card, sparkline, recent list) re-render.
 *
 * The form is short (< 1 minute to fill) so no beforeunload guard :
 * the orthostatic log is the longer flow that warrants one.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Button, Banner } from '@/v2/components/primitives'
import {
  fieldInputStyle,
  fieldSelectStyle,
  fieldTextareaStyle,
} from '@/app/v2/_tail-shared/formField'
import FormField from './FormField'

interface FormState {
  date: string
  time: string
  systolic: string
  diastolic: string
  pulse: string
  position: 'sitting' | 'standing' | 'lying' | 'unknown'
  notes: string
}

function initialState(): FormState {
  const now = new Date()
  return {
    date: format(now, 'yyyy-MM-dd'),
    time: format(now, 'HH:mm'),
    systolic: '',
    diastolic: '',
    pulse: '',
    position: 'sitting',
    notes: '',
  }
}

export default function BPLogForm() {
  const [form, setForm] = useState<FormState>(initialState)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const pulseNum = form.pulse.trim().length > 0 ? Number(form.pulse) : null
      const body = {
        date: form.date,
        time: form.time,
        systolic: Number(form.systolic),
        diastolic: Number(form.diastolic),
        pulse: pulseNum,
        position: form.position,
        notes: form.notes.trim(),
      }
      const res = await fetch('/api/bp/log', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        // Reset to fresh defaults so the next log is friction-free.
        setForm(initialState())
        router.refresh()
        return
      }
      let message = `Could not save reading (${res.status}).`
      try {
        const parsed = (await res.json()) as { error?: string }
        if (parsed && typeof parsed.error === 'string' && parsed.error.length > 0) {
          message = parsed.error
        }
      } catch {
        /* non-JSON body : keep fallback */
      }
      setError(message)
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
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
        Log a reading
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 'var(--v2-space-3)',
        }}
      >
        <FormField label="Date">
          <input
            type="date"
            value={form.date}
            onChange={(e) => update('date', e.target.value)}
            required
            style={fieldInputStyle}
          />
        </FormField>
        <FormField label="Time">
          <input
            type="time"
            value={form.time}
            onChange={(e) => update('time', e.target.value)}
            style={fieldInputStyle}
          />
        </FormField>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 'var(--v2-space-3)',
        }}
      >
        <FormField label="Systolic (mmHg)">
          <input
            type="number"
            inputMode="numeric"
            min={50}
            max={260}
            step={1}
            value={form.systolic}
            onChange={(e) => update('systolic', e.target.value)}
            required
            placeholder="120"
            style={fieldInputStyle}
          />
        </FormField>
        <FormField label="Diastolic (mmHg)">
          <input
            type="number"
            inputMode="numeric"
            min={30}
            max={180}
            step={1}
            value={form.diastolic}
            onChange={(e) => update('diastolic', e.target.value)}
            required
            placeholder="80"
            style={fieldInputStyle}
          />
        </FormField>
        <FormField label="Pulse (optional)">
          <input
            type="number"
            inputMode="numeric"
            min={20}
            max={250}
            step={1}
            value={form.pulse}
            onChange={(e) => update('pulse', e.target.value)}
            placeholder="70"
            style={fieldInputStyle}
          />
        </FormField>
      </div>

      <FormField label="Position">
        <select
          value={form.position}
          onChange={(e) =>
            update('position', e.target.value as FormState['position'])
          }
          style={fieldSelectStyle}
        >
          <option value="sitting">Sitting</option>
          <option value="standing">Standing</option>
          <option value="lying">Lying</option>
        </select>
      </FormField>

      <FormField label="Notes">
        <textarea
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
          rows={2}
          maxLength={280}
          placeholder="Morning, post-coffee, anything worth remembering."
          style={fieldTextareaStyle}
        />
      </FormField>

      {error && (
        <Banner intent="danger" title="Could not save" body={error} />
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        disabled={submitting}
      >
        {submitting ? 'Saving...' : 'Save reading'}
      </Button>
    </form>
  )
}
