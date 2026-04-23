'use client'

/*
 * RecipeBuilderForm
 *
 * Owns state for name, servings, notes, and the running ingredient
 * list. Computes per-serving totals live. Submits form-encoded to
 * /api/calories/recipes, then routes back to /v2/calories/search.
 */

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card } from '@/v2/components/primitives'
import IngredientList from './IngredientList'
import IngredientDraft, { type IngredientDraftShape } from './IngredientDraft'

const blank = (): IngredientDraftShape => ({
  name: '', calories: '', carbs: '', protein: '', fat: '', fiber: '', sodium: '',
})

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

const toNum = (s: string) => {
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  )
}

export default function RecipeBuilderForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [servings, setServings] = useState('1')
  const [notes, setNotes] = useState('')
  const [ingredients, setIngredients] = useState<IngredientDraftShape[]>([])
  const [draft, setDraft] = useState<IngredientDraftShape>(blank())

  const updateDraft = (field: keyof IngredientDraftShape, value: string) =>
    setDraft((d) => ({ ...d, [field]: value }))

  const addIngredient = () => {
    const n = draft.name.trim()
    if (!n || draft.calories === '' || !Number.isFinite(Number(draft.calories))) return
    setIngredients((prev) => [...prev, { ...draft, name: n }])
    setDraft(blank())
  }

  const removeIngredient = (i: number) =>
    setIngredients((prev) => prev.filter((_, idx) => idx !== i))

  const perServing = useMemo(() => {
    const s = Math.max(1, Number(servings) || 1)
    const t = ingredients.reduce(
      (acc, i) => ({
        calories: acc.calories + toNum(i.calories),
        carbs: acc.carbs + toNum(i.carbs),
        protein: acc.protein + toNum(i.protein),
        fat: acc.fat + toNum(i.fat),
      }),
      { calories: 0, carbs: 0, protein: 0, fat: 0 },
    )
    return { calories: t.calories / s, carbs: t.carbs / s, protein: t.protein / s, fat: t.fat / s }
  }, [ingredients, servings])

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    if (ingredients.length === 0) {
      setError('Add at least one ingredient first.')
      return
    }
    const body = new URLSearchParams()
    body.append('name', name)
    body.append('servings', servings)
    if (notes.trim()) body.append('notes', notes)
    for (const ing of ingredients) {
      body.append('ingredientName', ing.name)
      body.append('ingredientCalories', ing.calories || '0')
      body.append('ingredientProtein', ing.protein || '0')
      body.append('ingredientCarbs', ing.carbs || '0')
      body.append('ingredientFat', ing.fat || '0')
      body.append('ingredientFiber', ing.fiber || '0')
      body.append('ingredientSodium', ing.sodium || '0')
    }
    startTransition(async () => {
      try {
        const res = await fetch('/api/calories/recipes', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
          body: body.toString(),
        })
        if (!res.ok) {
          setError("That didn't go through. Want to try again?")
          return
        }
        router.push('/v2/calories/search?view=my-recipes&saved=1')
        router.refresh()
      } catch {
        setError("That didn't go through. Want to try again?")
      }
    })
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
      <Field label="Name">
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Slow-cooker chicken soup"
          style={inputStyle}
        />
      </Field>

      <Field label="Servings">
        <input
          type="number"
          required
          min="1"
          step="1"
          inputMode="numeric"
          value={servings}
          onChange={(e) => setServings(e.target.value)}
          style={inputStyle}
        />
      </Field>

      <IngredientList ingredients={ingredients} onRemove={removeIngredient} />

      <IngredientDraft draft={draft} onUpdate={updateDraft} onAdd={addIngredient} />

      <Card padding="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-1)' }}>
          <span style={labelStyle}>Per serving</span>
          <div
            style={{
              fontSize: 'var(--v2-text-2xl)',
              fontWeight: 'var(--v2-weight-bold)',
              color: 'var(--v2-text-primary)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {Math.round(perServing.calories)} cal
          </div>
          <div
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            C {perServing.carbs.toFixed(1)}g &middot; P {perServing.protein.toFixed(1)}g &middot; F {perServing.fat.toFixed(1)}g
          </div>
        </div>
      </Card>

      <Field label="Notes">
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Prep time, swaps, variations"
          style={{ ...inputStyle, minHeight: 88, resize: 'vertical', lineHeight: 'var(--v2-leading-normal)' }}
        />
      </Field>

      {error && (
        <p role="alert" style={{ margin: 0, color: 'var(--v2-accent-warning)', fontSize: 'var(--v2-text-sm)' }}>
          {error}
        </p>
      )}

      <Button variant="primary" size="lg" fullWidth disabled={pending} type="submit">
        {pending ? 'Saving…' : 'Save recipe'}
      </Button>
    </form>
  )
}
