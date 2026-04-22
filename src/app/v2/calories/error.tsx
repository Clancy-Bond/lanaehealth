'use client'

/*
 * Route-level error boundary for /v2/calories (dashboard).
 *
 * Next.js App Router auto-wires this file around the route segment, so any
 * throw from page.tsx (failed Promise.all loader, Supabase 5xx, token rotation,
 * etc.) lands here instead of Next's default dark error shell. See
 * https://nextjs.org/docs/app/building-your-application/routing/error-handling
 *
 * The subject copy is kept here (not in the shared component) so each route
 * can speak specifically about what failed to load.
 */
import CaloriesLoadError from './_components/CaloriesLoadError'

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
      title="We couldn't load today's calories"
      body="That's almost always a brief network hiccup. Give it a moment and try again."
    />
  )
}
