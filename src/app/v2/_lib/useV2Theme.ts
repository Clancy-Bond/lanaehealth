'use client'

/*
 * useV2Theme
 *
 * Lanae cannot read the default Oura-dark chrome. This hook backs the
 * Dark / Light / System toggle in /v2/settings, persists the choice in
 * localStorage, and writes data-theme on the .v2 root so tokens.css
 * swaps the palette without a re-render storm.
 *
 * Tri-state because "system" is a real user request: someone whose
 * phone auto-switches at sundown wants the app to follow. The two
 * concrete states ('dark', 'light') are surfaced as `resolvedTheme`
 * for components that need to branch (e.g. picking a chart palette).
 *
 * SSR safety: storage is only read in useEffect; the initial server
 * render is blank for the toggle (it hydrates the saved value on the
 * first client tick). The pre-paint inline script in
 * src/app/v2/layout.tsx is what prevents a flash; this hook is the
 * client-side counterpart for live changes.
 */
import { useCallback, useEffect, useState } from 'react'

export type V2Theme = 'dark' | 'light' | 'system'
export type V2ResolvedTheme = 'dark' | 'light'

const STORAGE_KEY = 'v2-theme'

function isStoredTheme(value: unknown): value is V2Theme {
  return value === 'dark' || value === 'light' || value === 'system'
}

function readStoredTheme(): V2Theme {
  if (typeof window === 'undefined') return 'dark'
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return isStoredTheme(raw) ? raw : 'dark'
  } catch {
    return 'dark'
  }
}

function readSystemPreference(): V2ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark'
}

function resolveTheme(theme: V2Theme): V2ResolvedTheme {
  if (theme === 'system') return readSystemPreference()
  return theme
}

/**
 * Walks up from any element until it finds the .v2 root. Falls back
 * to documentElement so the toggle still works in tests / Storybook
 * where the .v2 wrapper is not present.
 */
function findV2Root(): HTMLElement {
  if (typeof document === 'undefined') {
    throw new Error('useV2Theme: document is not available')
  }
  const root = document.querySelector<HTMLElement>('.v2')
  return root ?? document.documentElement
}

function applyResolvedTheme(resolved: V2ResolvedTheme): void {
  const root = findV2Root()
  if (resolved === 'light') {
    root.setAttribute('data-theme', 'light')
  } else {
    root.removeAttribute('data-theme')
  }
}

export interface UseV2ThemeReturn {
  theme: V2Theme
  resolvedTheme: V2ResolvedTheme
  setTheme: (next: V2Theme) => void
}

export function useV2Theme(): UseV2ThemeReturn {
  // Both pieces of state hydrate on the first client tick. SSR returns
  // 'dark' so the markup matches the pre-paint script default; the
  // inline script in layout.tsx may have already swapped data-theme
  // before this hook ever runs.
  const [theme, setThemeState] = useState<V2Theme>('dark')
  const [resolved, setResolved] = useState<V2ResolvedTheme>('dark')

  // Hydrate from storage and current system preference.
  useEffect(() => {
    const stored = readStoredTheme()
    setThemeState(stored)
    setResolved(resolveTheme(stored))
  }, [])

  // When theme changes, persist it, recompute resolved, and write the
  // attribute on the .v2 root. We always recompute resolved here so a
  // user flipping their OS preference while on 'system' updates live.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // localStorage may be disabled (private mode); silently ignore.
    }
    const next = resolveTheme(theme)
    setResolved(next)
    applyResolvedTheme(next)
  }, [theme])

  // Live-watch the OS preference so 'system' tracks sundown changes.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const media = window.matchMedia('(prefers-color-scheme: light)')
    const handle = (event: MediaQueryListEvent) => {
      // Only react when the user is actually on 'system'; otherwise
      // their explicit choice wins.
      if (theme !== 'system') return
      const next: V2ResolvedTheme = event.matches ? 'light' : 'dark'
      setResolved(next)
      applyResolvedTheme(next)
    }
    // addEventListener is the modern API; the older Safari path uses
    // addListener. We try the modern one and fall back.
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handle)
      return () => media.removeEventListener('change', handle)
    }
    media.addListener(handle)
    return () => media.removeListener(handle)
  }, [theme])

  const setTheme = useCallback((next: V2Theme) => {
    setThemeState(next)
  }, [])

  return { theme, resolvedTheme: resolved, setTheme }
}
