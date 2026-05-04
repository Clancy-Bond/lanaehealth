'use client'

/*
 * /v2/cycle/predict error boundary
 *
 * Predictions are generated from loadCycleContext, which combines
 * mean cycle length, SD, and luteal assumptions. If anything throws
 * mid-calculation, render v2 chrome with a kind retry CTA.
 */
import { useEffect } from 'react'
import { ErrorState } from '@/v2/components/states'
import CycleSurface from '../_components/CycleSurface'

export default function V2CyclePredictError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[v2/cycle/predict error boundary]', error)
    }
  }, [error])

  return (
    <CycleSurface>
      <ErrorState
        title="What's coming"
        headline="Predictions did not load just now"
        body="The ranges depend on a fresh look at your history. Try again, and your records stay intact either way."
        reset={reset}
      />
    </CycleSurface>
  )
}
