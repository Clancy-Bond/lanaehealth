'use client'

/*
 * Route-level error boundary for /v2/calories/meal-delete (delete confirmation).
 *
 * Covers failures from the preview fetch. The body copy explicitly reassures
 * the patient that nothing was deleted, since the failure happened before the
 * confirmation screen could even render its preview.
 */
import CaloriesLoadError from '../_components/CaloriesLoadError'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <CaloriesLoadError
      error={error}
      reset={reset}
      title="We couldn't load this meal"
      body="Your food log is safe, nothing was deleted. This is almost always a brief network hiccup. Give it a moment and try again."
    />
  )
}
