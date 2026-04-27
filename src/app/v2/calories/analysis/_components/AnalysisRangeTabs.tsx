'use client'

/**
 * AnalysisRangeTabs
 *
 * MFN parity (frame_0010 / frame_0203): the 7D / 14D / 30D / Custom
 * pill row that sits above the calorie sparkline + bar chart on
 * MyNetDiary's Analysis screens.
 *
 * Range state lives in the URL (?range=7d|14d|30d|custom) so deep
 * links restore the view and the back/forward buttons cycle ranges
 * naturally. Other search params (?tab=...) are preserved when
 * switching.
 *
 * Custom is intentionally a placeholder: tapping it routes to the
 * existing range with a `?range=custom` so the URL records the
 * intent, but we render the same 30-day window. Wiring an actual
 * custom date picker is a follow-up; surfacing the affordance lets
 * the layout match the reference today.
 *
 * Why this is its own component (not SegmentedControl): four
 * options at a tighter density than SegmentedControl was tuned for,
 * and the design needs a thin underline-on-active treatment that
 * the segmented chassis does not natively support. Cheap inline
 * implementation matches the existing TabStrip primitive aesthetic
 * without pulling that primitive in for four pills.
 */
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import type { AnalysisRange } from './range-helpers'

// Re-export so consumers that already import the type from this
// module keep compiling. The canonical source is range-helpers.ts.
export type { AnalysisRange }

const RANGES: Array<{ value: AnalysisRange; label: string }> = [
  { value: '7d', label: '7D' },
  { value: '14d', label: '14D' },
  { value: '30d', label: '30D' },
  { value: 'custom', label: 'Custom' },
]

export interface AnalysisRangeTabsProps {
  active: AnalysisRange
}

export default function AnalysisRangeTabs({ active }: AnalysisRangeTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const onSelect = (next: AnalysisRange) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next === '30d') {
      params.delete('range')
    } else {
      params.set('range', next)
    }
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <div
      role="tablist"
      aria-label="Time range"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 0,
        background: 'var(--v2-bg-surface)',
        border: '1px solid var(--v2-border-subtle)',
        borderRadius: 'var(--v2-radius-md)',
        padding: 4,
      }}
    >
      {RANGES.map((r) => {
        const isActive = r.value === active
        return (
          <button
            key={r.value}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(r.value)}
            style={{
              minHeight: 36,
              padding: '0 var(--v2-space-2)',
              border: 0,
              background: isActive ? 'var(--v2-bg-card)' : 'transparent',
              color: isActive ? 'var(--v2-text-primary)' : 'var(--v2-text-secondary)',
              fontSize: 'var(--v2-text-sm)',
              fontWeight: isActive ? 'var(--v2-weight-bold)' : 'var(--v2-weight-medium)',
              fontFamily: 'inherit',
              cursor: 'pointer',
              borderRadius: 'var(--v2-radius-sm)',
              transition: 'background 120ms ease, color 120ms ease',
            }}
          >
            {r.label}
          </button>
        )
      })}
    </div>
  )
}

// rangeToDays moved to range-helpers.ts so server components can
// import it without crossing the use-client boundary.
export { rangeToDays } from './range-helpers'
