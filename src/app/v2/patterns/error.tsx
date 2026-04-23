'use client'

/*
 * /v2/patterns error boundary
 *
 * The patterns hub depends on correlation_results plus the
 * narrator. If either fails (transient supabase, narrator throw),
 * land here instead of the default Next error UI.
 */
import { useEffect } from 'react'
import { ErrorState } from '@/v2/components/states'

export default function V2PatternsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[v2/patterns error boundary]', error)
    }
  }, [error])

  return (
    <ErrorState
      title="Patterns"
      headline="We could not load patterns just now"
      body="The correlations engine usually responds in seconds. Try again, and your records stay intact either way."
      reset={reset}
    />
  )
}
