'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/v2/components/primitives'
import type { Recipe } from '@/lib/api/recipes'

export default function RecipeUrlImportForm() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<Recipe | null>(null)
  const [saving, setSaving] = useState(false)

  const onParse = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setParsed(null)
    const trimmed = url.trim()
    if (!trimmed) return
    setPending(true)
    try {
      const res = await fetch('/api/calories/recipes/import-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })
      const j = (await res.json()) as { ok?: boolean; recipe?: Recipe; error?: string }
      if (!res.ok || !j.recipe) {
        setError(j.error ?? 'Could not parse the recipe.')
      } else {
        setParsed(j.recipe)
      }
    } finally {
      setPending(false)
    }
  }

  const onSave = async () => {
    if (!parsed) return
    setSaving(true)
    setError(null)
    const res = await fetch('/api/calories/recipes/save-external', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'user_url', recipe: parsed }),
    })
    const j = (await res.json()) as { ok?: boolean; recipe?: Recipe; error?: string }
    setSaving(false)
    if (!res.ok || !j.recipe) {
      setError(j.error ?? 'Could not save.')
      return
    }
    router.push(`/v2/calories/recipes/${encodeURIComponent(j.recipe.id)}`)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-4)',
      }}
    >
      <form
        onSubmit={onParse}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}
      >
        <label
          htmlFor="recipe-url"
          style={{
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--v2-tracking-wide)',
          }}
        >
          Recipe URL
        </label>
        <input
          id="recipe-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://yourfavoriteblog.com/best-pasta-recipe"
          required
          data-testid="recipe-url-input"
          style={{
            width: '100%',
            minHeight: 'var(--v2-touch-target-min)',
            padding: 'var(--v2-space-3) var(--v2-space-4)',
            borderRadius: 'var(--v2-radius-md)',
            background: 'var(--v2-bg-card)',
            color: 'var(--v2-text-primary)',
            border: '1px solid var(--v2-border-strong)',
            fontSize: 'var(--v2-text-base)',
            fontFamily: 'inherit',
          }}
        />
        <button
          type="submit"
          disabled={pending}
          data-testid="recipe-parse-btn"
          style={{
            minHeight: 'var(--v2-touch-target-min)',
            borderRadius: 999,
            background: 'var(--v2-accent-primary)',
            color: 'var(--v2-on-accent)',
            border: 'none',
            fontSize: 'var(--v2-text-base)',
            fontWeight: 'var(--v2-weight-semibold)',
            cursor: pending ? 'default' : 'pointer',
          }}
        >
          {pending ? 'Parsing...' : 'Parse recipe'}
        </button>
        {error && (
          <div role="alert" style={{ color: 'var(--v2-accent-danger)', fontSize: 'var(--v2-text-sm)' }}>
            {error}
          </div>
        )}
      </form>

      {parsed && (
        <Card padding="md">
          <div
            style={{
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
              marginBottom: 4,
            }}
          >
            {parsed.name}
          </div>
          <div
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
              marginBottom: 'var(--v2-space-3)',
            }}
          >
            {parsed.caloriesPerServing} cal/serving, {parsed.servings} serving
            {parsed.servings === 1 ? '' : 's'}, {parsed.ingredients.length} ingredient
            {parsed.ingredients.length === 1 ? '' : 's'}
          </div>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            data-testid="recipe-save-imported-btn"
            style={{
              width: '100%',
              minHeight: 'var(--v2-touch-target-min)',
              borderRadius: 999,
              background: 'var(--v2-accent-primary)',
              color: 'var(--v2-on-accent)',
              border: 'none',
              fontSize: 'var(--v2-text-base)',
              fontWeight: 'var(--v2-weight-semibold)',
              cursor: saving ? 'default' : 'pointer',
            }}
          >
            {saving ? 'Saving...' : 'Save to my recipes'}
          </button>
        </Card>
      )}
    </div>
  )
}
