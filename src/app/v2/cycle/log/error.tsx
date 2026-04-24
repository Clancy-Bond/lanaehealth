'use client'

/*
 * /v2/cycle/log error boundary
 *
 * The log route fetches the day's existing entry plus active_problems
 * and health_profile to gate endo-mode. A failure on any of those
 * should not blank the form; render v2 chrome with a kind retry.
 */
import { useEffect } from 'react'
import { ErrorState } from '@/v2/components/states'

export default function V2CycleLogError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[v2/cycle/log error boundary]', error)
    }
  }, [error])

  return (
    <ErrorState
      title="Log cycle"
      headline="The log form did not finish loading"
      body="This usually clears in a moment. Anything you have already saved today is still in your records."
      reset={reset}
    />
  )
}
