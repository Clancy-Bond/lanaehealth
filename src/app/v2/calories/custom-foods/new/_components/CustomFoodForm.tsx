'use client'

/*
 * CustomFoodForm
 *
 * Simple nutrition-label entry. Required: name, serving label,
 * calories. Primary macros are inline; micronutrients live in a
 * collapsible disclosure so the form stays short on a phone screen.
 *
 * Submit path: fetch POST to /api/calories/custom-foods (form-encoded,
 * matching the legacy endpoint contract), then client-side redirect
 * to the v2 search page so we stay inside v2 chrome.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/v2/components/primitives'

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

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  )
}

export default function CustomFoodForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showMore, setShowMore] = useState(false)

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const fd = new FormData(form)
    const body = new URLSearchParams()
    for (const [k, v] of fd.entries()) {
      if (typeof v === 'string') body.append(k, v)
    }
    startTransition(async () => {
      try {
        const res = await fetch('/api/calories/custom-foods', {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            accept: 'application/json',
          },
          body: body.toString(),
        })
        if (!res.ok) {
          setError("That didn't go through. Want to try again?")
          return
        }
        router.push('/v2/calories/search?view=custom&saved=1')
        router.refresh()
      } catch {
        setError("That didn't go through. Want to try again?")
      }
    })
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}
    >
      <Field label="Name">
        <input type="text" name="name" required placeholder="Grandma's chicken soup" style={inputStyle} />
      </Field>

      <Field label="Serving label">
        <input type="text" name="servingLabel" required placeholder="1 bowl, 100 g" style={inputStyle} />
      </Field>

      <Field label="Calories">
        <input type="number" name="calories" required min="0" step="0.1" inputMode="decimal" style={inputStyle} />
      </Field>

      <Field label="Carbs (g)">
        <input type="number" name="carbs" min="0" step="0.1" inputMode="decimal" style={inputStyle} />
      </Field>

      <Field label="Protein (g)">
        <input type="number" name="protein" min="0" step="0.1" inputMode="decimal" style={inputStyle} />
      </Field>

      <Field label="Fat (g)">
        <input type="number" name="fat" min="0" step="0.1" inputMode="decimal" style={inputStyle} />
      </Field>

      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        aria-expanded={showMore}
        style={{
          alignSelf: 'flex-start',
          minHeight: 'var(--v2-touch-target-min)',
          padding: 'var(--v2-space-2) var(--v2-space-3)',
          background: 'transparent',
          color: 'var(--v2-accent-primary)',
          border: 0,
          fontSize: 'var(--v2-text-sm)',
          fontWeight: 'var(--v2-weight-semibold)',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        {showMore ? 'Hide extra nutrients' : 'More nutrients'}
      </button>

      {showMore && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
          <Field label="Fiber (g)">
            <input type="number" name="fiber" min="0" step="0.1" inputMode="decimal" style={inputStyle} />
          </Field>
          <Field label="Sugar (g)">
            <input type="number" name="sugar" min="0" step="0.1" inputMode="decimal" style={inputStyle} />
          </Field>
          <Field label="Sodium (mg)">
            <input type="number" name="sodium" min="0" step="1" inputMode="numeric" style={inputStyle} />
          </Field>
          <Field label="Calcium (mg)">
            <input type="number" name="calcium" min="0" step="1" inputMode="numeric" style={inputStyle} />
          </Field>
          <Field label="Iron (mg)">
            <input type="number" name="iron" min="0" step="0.1" inputMode="decimal" style={inputStyle} />
          </Field>
          <Field label="Potassium (mg)">
            <input type="number" name="potassium" min="0" step="1" inputMode="numeric" style={inputStyle} />
          </Field>
        </div>
      )}

      <Field label="Notes">
        <textarea
          name="notes"
          rows={3}
          placeholder="Prep, source, variants"
          style={{ ...inputStyle, minHeight: 88, resize: 'vertical', lineHeight: 'var(--v2-leading-normal)' }}
        />
      </Field>

      {error && (
        <p role="alert" style={{ margin: 0, color: 'var(--v2-accent-warning)', fontSize: 'var(--v2-text-sm)' }}>
          {error}
        </p>
      )}

      <Button variant="primary" size="lg" fullWidth disabled={pending} type="submit">
        {pending ? 'Saving…' : 'Save custom food'}
      </Button>
    </form>
  )
}
