'use client'

/*
 * /v2/calories error boundary
 *
 * The calories page already wraps its server fetches in a try/catch
 * to render CaloriesLoadError. This boundary is the safety net for
 * anything that escapes that wrap (a child render throw, a hook
 * failure in a client subcomponent).
 */
import { useEffect } from 'react'
import { ErrorState } from '@/v2/components/states'

export default function V2CaloriesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[v2/calories error boundary]', error)
    }
  }, [error])

  return (
    <ErrorState
      title="Calories"
      headline="Calories did not finish loading"
      body="Usually a brief network hiccup. Your meal logs are still safely recorded."
      reset={reset}
    />
  )
}
