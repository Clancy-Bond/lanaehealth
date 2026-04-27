/**
 * Server-safe helpers for the analysis time-range tabs.
 *
 * Why this file exists separately from AnalysisRangeTabs.tsx:
 * The tabs component is `'use client'` because it owns the URL
 * router push on tap. Server components (analysis/page.tsx) need
 * `parseRange` + `rangeToDays` to compute the data window before
 * rendering. Next.js will refuse to import non-component exports
 * from a `'use client'` boundary at SSR time and the page renders
 * an error boundary on first hit. Splitting these pure helpers
 * into their own server-safe module fixes that.
 *
 * Both this module AND the tabs component import the AnalysisRange
 * type from here so there's only one source of truth.
 */

export type AnalysisRange = '7d' | '14d' | '30d' | 'custom'

const VALID_RANGES: readonly AnalysisRange[] = ['7d', '14d', '30d', 'custom'] as const

export function parseRange(raw: string | undefined): AnalysisRange {
  if (!raw) return '30d'
  return (VALID_RANGES as readonly string[]).includes(raw)
    ? (raw as AnalysisRange)
    : '30d'
}

/**
 * Convert a range value to (days, label) for the data loaders.
 * Custom is a UI placeholder until the date-picker ships; we back
 * it with 30 days so the page renders meaningful numbers, but the
 * URL records the user's selection so a follow-up can read
 * ?range=custom + a custom date range pair without further plumbing.
 */
export function rangeToDays(range: AnalysisRange): { days: number; label: string } {
  switch (range) {
    case '7d':
      return { days: 7, label: '7 days' }
    case '14d':
      return { days: 14, label: '14 days' }
    case 'custom':
      return { days: 30, label: 'custom' }
    case '30d':
    default:
      return { days: 30, label: '30 days' }
  }
}
