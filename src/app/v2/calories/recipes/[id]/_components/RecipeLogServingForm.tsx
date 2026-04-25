'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import { Card } from '@/v2/components/primitives'

const VALID_MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const
type Meal = (typeof VALID_MEALS)[number]

interface Props {
  recipeId: string
  defaultDate?: string
  defaultMeal?: string
}

function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

function clampMeal(raw: string | undefined): Meal {
  return (VALID_MEALS as readonly string[]).includes(raw ?? '')
    ? (raw as Meal)
    : 'snack'
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 'var(--v2-touch-target-min)',
  padding: 'var(--v2-space-3) var(--v2-space-4)',
  borderRadius: 'var(--v2-radius-md)',
  background: 'var(--v2-bg-card)',
  color: 'var(--v2-text-primary)',
  border: '1px solid var(--v2-border-strong)',
  fontSize: 'var(--v2-text-base)',
  fontFamily: 'inherit',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
      <span
        style={{
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--v2-tracking-wide)',
        }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}

export default function RecipeLogServingForm({
  recipeId,
  defaultDate,
  defaultMeal,
}: Props) {
  const router = useRouter()
  const [servings, setServings] = useState('1')
  const [meal, setMeal] = useState<Meal>(clampMeal(defaultMeal))
  const [date, setDate] = useState(defaultDate ?? todayISO())
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setDone(false)
    setPending(true)
    try {
      const res = await fetch('/api/calories/recipes/log-serving', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          recipeId,
          servings: Number(servings) || 1,
          targetMeal: meal,
          targetDate: date,
        }),
      })
      const j = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok) {
        setError(j.error ?? 'Could not log.')
        return
      }
      setDone(true)
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <Card padding="md">
      <div
        style={{
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--v2-tracking-wide)',
          marginBottom: 'var(--v2-space-3)',
        }}
      >
        Log a serving
      </div>
      <form
        onSubmit={onSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-3)',
        }}
      >
        <Field label="Servings">
          <input
            type="number"
            step="0.25"
            min="0.25"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            data-testid="recipe-log-servings"
            style={inputStyle}
          />
        </Field>
        <Field label="Meal">
          <select
            value={meal}
            onChange={(e) => setMeal(e.target.value as Meal)}
            data-testid="recipe-log-meal"
            style={inputStyle}
          >
            {VALID_MEALS.map((m) => (
              <option key={m} value={m}>
                {m[0].toUpperCase() + m.slice(1)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            data-testid="recipe-log-date"
            style={inputStyle}
          />
        </Field>
        <button
          type="submit"
          disabled={pending}
          data-testid="recipe-log-submit"
          style={{
            minHeight: 'var(--v2-touch-target-min)',
            borderRadius: 999,
            background: done ? 'var(--v2-accent-success)' : 'var(--v2-accent-primary)',
            color: 'var(--v2-on-accent)',
            border: 'none',
            fontSize: 'var(--v2-text-base)',
            fontWeight: 'var(--v2-weight-semibold)',
            cursor: pending ? 'default' : 'pointer',
          }}
        >
          {done ? 'Logged' : pending ? 'Logging...' : 'Log a serving'}
        </button>
        {error && (
          <div role="alert" style={{ color: 'var(--v2-accent-danger)', fontSize: 'var(--v2-text-sm)' }}>
            {error}
          </div>
        )}
      </form>
    </Card>
  )
}
