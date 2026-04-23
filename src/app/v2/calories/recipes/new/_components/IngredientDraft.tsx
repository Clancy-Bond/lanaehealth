'use client'

/*
 * IngredientDraft
 *
 * Inline editor for one ingredient. Name on its own row, macros in
 * a 2-column grid below, then an "Add to recipe" button that fires
 * upward. Parent owns the draft state so it can reset on submit.
 */

import { Button, Card } from '@/v2/components/primitives'

export interface IngredientDraftShape {
  name: string
  calories: string
  carbs: string
  protein: string
  fat: string
  fiber: string
  sodium: string
}

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

const FIELDS: Array<{
  key: keyof IngredientDraftShape
  label: string
  step?: string
  mode?: 'decimal' | 'numeric'
}> = [
  { key: 'calories', label: 'Calories' },
  { key: 'carbs', label: 'Carbs (g)' },
  { key: 'protein', label: 'Protein (g)' },
  { key: 'fat', label: 'Fat (g)' },
  { key: 'fiber', label: 'Fiber (g)' },
  { key: 'sodium', label: 'Sodium (mg)', step: '1', mode: 'numeric' },
]

export default function IngredientDraft({
  draft,
  onUpdate,
  onAdd,
}: {
  draft: IngredientDraftShape
  onUpdate: (field: keyof IngredientDraftShape, value: string) => void
  onAdd: () => void
}) {
  const canAdd =
    Boolean(draft.name.trim()) &&
    draft.calories !== '' &&
    Number.isFinite(Number(draft.calories))

  return (
    <Card padding="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
        <span style={labelStyle}>Add ingredient</span>
        <input
          type="text"
          value={draft.name}
          onChange={(e) => onUpdate('name', e.target.value)}
          placeholder="Ingredient name"
          style={inputStyle}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--v2-space-2)' }}>
          {FIELDS.map((f) => (
            <input
              key={f.key}
              type="number"
              min="0"
              step={f.step ?? '0.1'}
              inputMode={f.mode ?? 'decimal'}
              value={draft[f.key]}
              onChange={(e) => onUpdate(f.key, e.target.value)}
              placeholder={f.label}
              style={inputStyle}
            />
          ))}
        </div>
        <Button variant="secondary" size="sm" onClick={onAdd} disabled={!canAdd}>
          Add to recipe
        </Button>
      </div>
    </Card>
  )
}
