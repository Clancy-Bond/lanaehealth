'use client'

/*
 * /v2 top-level error boundary
 *
 * Catches uncaught render or data-load errors anywhere under /v2
 * that a more specific route-level error.tsx does not handle.
 * Keeps the user inside the v2 chrome so the experience does not
 * fall through to the default Next error UI.
 */
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
    if (process.env.NODE_ENV !== 'production') {
      console.error('[v2 error boundary]', error)
    }
  }, [error])

  return (
    <ErrorState
      title="Something paused"
      headline="Something interrupted the connection"
      body="This usually clears in a moment. Your records are still safe."
      reset={reset}
    />
  )
}
