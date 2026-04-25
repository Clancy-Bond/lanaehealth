'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  initialQuery: string
  disabled?: boolean
}

export default function RecipeSearchForm({ initialQuery, disabled }: Props) {
  const router = useRouter()
  const [q, setQ] = useState(initialQuery)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const next = q.trim()
    if (!next) return
    router.push(`/v2/calories/recipes/search?q=${encodeURIComponent(next)}`)
  }

  return (
    <form onSubmit={onSubmit} role="search">
      <input
        type="search"
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Try chicken curry, lentil soup, banana bread..."
        aria-label="Search recipes"
        data-testid="recipe-search-input"
        disabled={disabled}
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
          opacity: disabled ? 0.5 : 1,
        }}
      />
    </form>
  )
}
