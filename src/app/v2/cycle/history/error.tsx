'use client'

/*
 * /v2/cycle/history error boundary
 *
 * History pulls a year of cycle entries plus the BBT log and the
 * completed-cycles list. A transient supabase blip should not blank
 * the screen; render v2 chrome with a kind retry CTA.
 */
import { useEffect } from 'react'
import { ErrorState } from '@/v2/components/states'
import CycleSurface from '../_components/CycleSurface'

export default function V2CycleHistoryError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[v2/cycle/history error boundary]', error)
    }
  }, [error])

  return (
    <CycleSurface>
      <ErrorState
        title="History"
        headline="History did not load all the way"
        body="Usually a brief network hiccup. Your past cycles are still safely recorded."
        reset={reset}
      />
    </CycleSurface>
  )
}
