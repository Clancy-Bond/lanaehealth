'use client'

/*
 * IngredientList
 *
 * Read-only view of the current recipe ingredients. Each row shows
 * the name + per-ingredient calories with a delete button. Empty
 * state nudges the user to use the Add ingredient card below.
 */

import { Card, ListRow } from '@/v2/components/primitives'

export interface IngredientView {
  name: string
  calories: string
}

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--v2-text-xs)',
  color: 'var(--v2-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: 'var(--v2-tracking-wide)',
}

export default function IngredientList({
  ingredients,
  onRemove,
}: {
  ingredients: IngredientView[]
  onRemove: (index: number) => void
}) {
  return (
    <Card padding="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
        <span style={labelStyle}>Ingredients</span>
        {ingredients.length === 0 && (
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-muted)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            What&apos;s in it? Add your first ingredient below.
          </p>
        )}
        {ingredients.map((ing, i) => {
          const cals = Number(ing.calories)
          const label = Number.isFinite(cals) ? Math.round(cals) : 0
          return (
            <ListRow
              key={i}
              divider={i < ingredients.length - 1}
              label={ing.name}
              subtext={`${label} cal`}
              trailing={
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  aria-label={`Remove ${ing.name}`}
                  style={{
                    minWidth: 'var(--v2-touch-target-min)',
                    minHeight: 'var(--v2-touch-target-min)',
                    background: 'transparent',
                    color: 'var(--v2-accent-danger)',
                    border: 0,
                    fontSize: 'var(--v2-text-lg)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  ×
                </button>
              }
            />
          )
        })}
      </div>
    </Card>
  )
}
