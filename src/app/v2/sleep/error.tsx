'use client'

/*
 * /v2/sleep error boundary
 *
 * Sleep depends on Oura. A slow or failed sync should not blank
 * the screen; render the v2 chrome with a kind retry CTA.
 */
import { useEffect } from 'react'
import { ErrorState } from '@/v2/components/states'

export default function V2SleepError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[v2/sleep error boundary]', error)
    }
  }, [error])

  return (
    <ErrorState
      title="Sleep"
      headline="Sleep data did not arrive"
      body="Oura sync sometimes lags by a few minutes. Try again, or check Oura directly."
      reset={reset}
    />
  )
}
