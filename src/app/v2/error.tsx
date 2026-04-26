'use client'

/*
 * /v2 top-level error boundary
 *
 * Catches uncaught render or data-load errors anywhere under /v2
 * that a more specific route-level error.tsx does not handle.
 * Keeps the user inside the v2 chrome so the experience does not
 * fall through to the default Next error UI.
 *
 * Forwards the error to Sentry so we hear about production incidents
 * without waiting for a user to report them. The PHI scrubber strips
 * sensitive fields before events leave the process.
 */
import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import { ErrorState } from '@/v2/components/states'

export default function V2Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
    if (process.env.NODE_ENV !== 'production') {
      console.error('[v2 error boundary]', error)
    }
  }, [error])

  return (
    <ErrorState
      title="Something paused"
      headline="Something interrupted the connection"
      body="This usually clears in a moment. Your records are still safe. Tap try again, and if it persists, the chat assistant can help you find what you were looking for."
      reset={reset}
    />
  )
}
