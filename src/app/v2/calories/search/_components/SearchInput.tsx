'use client'

/*
 * SearchInput
 *
 * MFN-style search field. Controlled form that submits a GET to the
 * same page with the typed query in `?q=`. Preserving `view` and
 * `meal` as hidden fields keeps the user pinned to the Search tab
 * and their target meal after submit.
 *
 * The form mode (GET, not a client fetch) means the results land as
 * a full server render, which keeps SSR cached calorie chips and the
 * per-result calorie data that searchFoods() already materialized.
 */

import { useState } from 'react'

export default function SearchInput({
  initialQuery,
  meal,
}: {
  initialQuery: string
  meal: string
}) {
  const [value, setValue] = useState(initialQuery)

  return (
    <form
      action="/v2/calories/search"
      method="get"
      role="search"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--v2-space-2)',
        padding: 'var(--v2-space-2) var(--v2-space-3)',
        border: '1px solid var(--v2-border-subtle)',
        borderRadius: 'var(--v2-radius-md)',
        background: 'var(--v2-bg-card)',
      }}
    >
      <input type="hidden" name="view" value="search" />
      {meal && <input type="hidden" name="meal" value={meal} />}
      <span aria-hidden style={{ color: 'var(--v2-text-muted)', display: 'inline-flex' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
        </svg>
      </span>
      <input
        type="text"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search foods"
        aria-label="Search foods"
        autoFocus
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 'var(--v2-touch-target-min)',
          border: 0,
          background: 'transparent',
          color: 'var(--v2-text-primary)',
          fontFamily: 'inherit',
          fontSize: 'var(--v2-text-base)',
          outline: 'none',
        }}
      />
    </form>
  )
}
