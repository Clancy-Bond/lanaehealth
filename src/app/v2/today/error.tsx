'use client'

/*
 * /v2/today error boundary
 *
 * Today reuses loadHomeContext, so it catches the same data-load
 * failures that Home does. Renders inside v2 chrome with a kind
 * retry CTA.
 */
import { useEffect } from 'react'
import { ErrorState } from '@/v2/components/states'

export default function V2TodayError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[v2/today error boundary]', error)
    }
  }, [error])

  return (
    <ErrorState
      title="Today"
      headline="Today did not load all the way"
      body="Usually a brief network hiccup. Try again to refresh the snapshot."
      reset={reset}
    />
  )
}
