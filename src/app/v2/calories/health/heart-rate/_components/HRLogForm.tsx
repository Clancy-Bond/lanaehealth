'use client'

/*
 * HRLogForm
 *
 * Light log form for a single HR spot-check. POSTs JSON to
 * /api/hr/log (same API the legacy page uses, via form-encoded
 * submit), then router.refresh() so the server components above
 * re-render with the new reading.
 *
 * Context default 'standing' because that's the most clinically
 * useful HR entry Lanae logs for POTS tracking : resting HR is
 * already in Oura. Short form, no beforeunload guard needed.
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
import { HR_CONTEXTS, type HRContext } from '@/lib/calories/heart-rate'

interface FormState {
  date: string
  time: string
  bpm: string
  context: HRContext
  notes: string
}

function initialState(): FormState {
  const now = new Date()
  return {
    date: format(now, 'yyyy-MM-dd'),
    time: format(now, 'HH:mm'),
    bpm: '',
    context: 'standing',
    notes: '',
  }
}

export default function HRLogForm() {
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
      const body = {
        date: form.date,
        time: form.time,
        bpm: Number(form.bpm),
        context: form.context,
        notes: form.notes.trim(),
      }
      const res = await fetch('/api/hr/log', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
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
        <FormField label="bpm">
          <input
            type="number"
            inputMode="numeric"
            min={20}
            max={250}
            step={1}
            value={form.bpm}
            onChange={(e) => update('bpm', e.target.value)}
            required
            placeholder="80"
            style={fieldInputStyle}
          />
        </FormField>
      </div>

      <FormField label="Context">
        <select
          value={form.context}
          onChange={(e) => update('context', e.target.value as HRContext)}
          style={fieldSelectStyle}
        >
          {HR_CONTEXTS.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Notes">
        <textarea
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
          rows={2}
          maxLength={280}
          placeholder="Right after standing, during palpitations, anything worth remembering."
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
