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
 *
 * 2026-04-24 fix: the original form used `--v2-bg-card` (#17171B) on
 * the dark theme's `--v2-bg-primary` (#0A0A0B) page background with a
 * 6%-alpha hairline border. Combined contrast was about 13 luminance
 * points - visually the input vanished into the page on iPhone, and a
 * user reported "USDA isn't connected" because they could not see
 * where to type. Bumped to `--v2-bg-elevated` (#1F1F25), thicker
 * border, brighter icon, plus a visible Search submit button so the
 * affordance is obvious without relying on Enter-only submission.
 */

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const DEBOUNCE_MS = 300
const MIN_QUERY = 2

export default function SearchInput({
  initialQuery,
  meal,
}: {
  initialQuery: string
  meal: string
}) {
  const [value, setValue] = useState(initialQuery)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const lastPushedRef = useRef<string>(initialQuery)

  // Live autocomplete: as the user types, push the new query into the
  // URL after DEBOUNCE_MS of inactivity. Next.js re-renders the page
  // with the new ?q= param, so SSR'd results land inline without a
  // separate client fetch path. Users still see the explicit Search
  // button as a fallback for slow connections / Enter-key submission.
  //
  // Skips queries shorter than MIN_QUERY chars to avoid hammering the
  // USDA API with single-letter searches that return junk results.
  useEffect(() => {
    const trimmed = value.trim()
    if (trimmed === lastPushedRef.current) return
    if (trimmed.length > 0 && trimmed.length < MIN_QUERY) return
    const handle = window.setTimeout(() => {
      const params = new URLSearchParams()
      params.set('view', 'search')
      if (meal) params.set('meal', meal)
      if (trimmed) params.set('q', trimmed)
      const next = `/v2/calories/search?${params.toString()}`
      router.replace(next, { scroll: false })
      lastPushedRef.current = trimmed
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [value, meal, router])

  return (
    <form
      action="/v2/calories/search"
      method="get"
      role="search"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--v2-space-2)',
        padding: 'var(--v2-space-2) var(--v2-space-2) var(--v2-space-2) var(--v2-space-3)',
        border: focused
          ? '1.5px solid var(--v2-accent-primary, #4DB8A8)'
          : '1px solid var(--v2-border-strong, rgba(255, 255, 255, 0.18))',
        borderRadius: 'var(--v2-radius-md)',
        background: 'var(--v2-bg-elevated)',
        boxShadow: focused
          ? '0 0 0 3px rgba(77, 184, 168, 0.18)'
          : 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
      }}
    >
      <input type="hidden" name="view" value="search" />
      {meal && <input type="hidden" name="meal" value={meal} />}
      <span
        aria-hidden
        onClick={() => inputRef.current?.focus()}
        style={{
          color: 'var(--v2-text-secondary, #C7C7CC)',
          display: 'inline-flex',
          cursor: 'text',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
        </svg>
      </span>
      <input
        ref={inputRef}
        type="text"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Search foods (e.g. egg, salmon, oatmeal)"
        aria-label="Search foods"
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
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
      {value.trim().length > 0 && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setValue('')
            inputRef.current?.focus()
          }}
          style={{
            background: 'transparent',
            border: 0,
            padding: 'var(--v2-space-1) var(--v2-space-2)',
            color: 'var(--v2-text-muted)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 'var(--v2-touch-target-min)',
            fontSize: 'var(--v2-text-base)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      )}
      <button
        type="submit"
        aria-label="Search"
        style={{
          background: value.trim().length > 0
            ? 'var(--v2-accent-primary, #4DB8A8)'
            : 'var(--v2-bg-card)',
          color: value.trim().length > 0
            ? '#0A0A0B'
            : 'var(--v2-text-muted)',
          border: '1px solid transparent',
          borderRadius: 'var(--v2-radius-sm, 8px)',
          padding: 'var(--v2-space-2) var(--v2-space-3)',
          fontFamily: 'inherit',
          fontSize: 'var(--v2-text-sm)',
          fontWeight: 'var(--v2-weight-semibold, 600)',
          cursor: value.trim().length > 0 ? 'pointer' : 'default',
          minHeight: 'var(--v2-touch-target-min)',
          transition: 'background 120ms ease, color 120ms ease',
        }}
        disabled={value.trim().length === 0}
      >
        Search
      </button>
    </form>
  )
}
