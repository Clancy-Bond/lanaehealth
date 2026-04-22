'use client'

/*
 * Route-level error boundary for /v2/calories/food (meal log).
 *
 * Covers failures from getDayTotals / getFoodEntriesByDateRange and any other
 * loaders on the food log page. See sibling error.tsx at /v2/calories for the
 * design rationale.
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
      title="We couldn't load your food log"
      body="That's almost always a brief network hiccup. Give it a moment and try again."
    />
  )
}
