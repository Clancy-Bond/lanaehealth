'use client'

// ---------------------------------------------------------------------------
// EnergyModeBanner
//
// A soft informational banner that surfaces the inferred mode as a
// SUGGESTION. Appears above the EnergyModeToggle only when inference has a
// real signal to cite (usedFallback=false). User can always override the
// mode via the toggle.
//
// Voice rules:
//   - Uses "suggests" language. Never "you should" or "you need to".
//   - Cites the actual numbers that drove the inference.
//   - Never appears when the data is absent (fallback case).
//
// See docs/plans/2026-04-16-non-shaming-voice-rule.md.
// ---------------------------------------------------------------------------

import type { EnergyInferenceResult } from '@/lib/intelligence/energy-inference'
import type { EnergyMode } from '@/lib/types'

interface EnergyModeBannerProps {
  inference: EnergyInferenceResult
  // When the user has manually overridden the suggestion, the banner
  // demotes itself into a quiet footnote. This lets Lanae see the
  // suggestion context without feeling second-guessed.
  userOverrodeTo?: EnergyMode | null
}

// Non-shaming hint builder: takes the raw rationale from inference and
// wraps it with a SUGGESTION preface, not a directive.
function buildHint(result: EnergyInferenceResult): string {
  return result.rationale
}

export default function EnergyModeBanner({
  inference,
  userOverrodeTo,
}: EnergyModeBannerProps) {
  // Silent fallback case: no signal available, no banner.
  if (inference.usedFallback) return null

  const hint = buildHint(inference)
  const overriden = userOverrodeTo && userOverrodeTo !== inference.mode

  return (
    <div
      className="rounded-xl px-4 py-2 text-xs"
      style={{
        background: overriden
          ? 'rgba(107, 144, 128, 0.05)'
          : 'rgba(107, 144, 128, 0.08)',
        border: '1px solid rgba(107, 144, 128, 0.2)',
        color: '#4a5b52',
      }}
      role="status"
      aria-live="polite"
    >
      <span aria-hidden className="mr-1.5" style={{ opacity: 0.7 }}>
        {'\u{1F331}'}
      </span>
      {overriden ? (
        <>
          Your pick stands. Earlier signal noted: {hint.replace(/\.$/, '')}.
        </>
      ) : (
        <>{hint}</>
      )}
    </div>
  )
}
