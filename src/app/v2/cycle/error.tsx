'use client'

/*
 * /v2/cycle error boundary
 *
 * Cycle pulls from cycle_entries, BBT log, and the prediction engine.
 * If any of those throws (transient supabase, prediction edge case),
 * land here instead of the default Next error UI so the reader stays
 * in v2 chrome.
 */
import { useEffect } from 'react'
import { ErrorState } from '@/v2/components/states'
import CycleSurface from './_components/CycleSurface'

export default function V2CycleError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[v2/cycle error boundary]', error)
    }
  }, [error])

  return (
    <CycleSurface>
      <ErrorState
        title="Cycle"
        headline="We could not load your cycle data right now"
        body="This usually clears in a moment. Your logged entries are still safely recorded."
        reset={reset}
      />
    </CycleSurface>
  )
}
