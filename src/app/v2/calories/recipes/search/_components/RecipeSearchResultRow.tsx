'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/v2/components/primitives'
import type { Recipe } from '@/lib/api/recipes'

interface Props {
  recipe: Recipe
}

export default function RecipeSearchResultRow({ recipe }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const onSave = async () => {
    setError(null)
    const res = await fetch('/api/calories/recipes/save-external', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source: recipe.source, recipe }),
    })
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      setError(j.error ?? 'Could not save.')
      return
    }
    setSaved(true)
    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <Card padding="md">
      <div
        style={{
          display: 'flex',
          gap: 'var(--v2-space-3)',
          alignItems: 'flex-start',
        }}
      >
        {recipe.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recipe.imageUrl}
            alt=""
            width={64}
            height={64}
            style={{
              width: 64,
              height: 64,
              objectFit: 'cover',
              borderRadius: 'var(--v2-radius-md)',
              flexShrink: 0,
            }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
              marginBottom: 4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {recipe.name}
          </div>
          <div
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
              marginBottom: 'var(--v2-space-2)',
            }}
          >
            {recipe.caloriesPerServing} cal/serving, {recipe.servings} serving
            {recipe.servings === 1 ? '' : 's'}
            {recipe.totalTimeMinutes ? `, ${recipe.totalTimeMinutes} min` : ''}
          </div>
          <button
            type="button"
            onClick={onSave}
            disabled={pending || saved}
            data-testid="recipe-save-btn"
            style={{
              minHeight: 36,
              padding: 'var(--v2-space-2) var(--v2-space-4)',
              borderRadius: 999,
              background: saved ? 'var(--v2-accent-success)' : 'var(--v2-accent-primary)',
              color: 'var(--v2-on-accent)',
              border: 'none',
              fontSize: 'var(--v2-text-sm)',
              fontWeight: 'var(--v2-weight-semibold)',
              cursor: pending || saved ? 'default' : 'pointer',
            }}
          >
            {saved ? 'Saved' : pending ? 'Saving...' : 'Save'}
          </button>
          {error && (
            <div
              role="alert"
              style={{
                marginTop: 'var(--v2-space-2)',
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-accent-danger)',
              }}
            >
              {error}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
