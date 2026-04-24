'use client'

/*
 * /v2/chat error boundary
 *
 * Handles uncaught render or data errors in the chat client. The
 * underlying /api/chat failures are surfaced inline as assistant
 * bubbles, so this boundary mostly catches hydration crashes.
 */
import { useEffect } from 'react'
import { ErrorState } from '@/v2/components/states'

export default function V2ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[v2 chat error boundary]', error)
    }
  }, [error])

  return (
    <ErrorState
      title="Ask AI"
      headline="The chat paused for a moment"
      body="Your conversation is safe. Try again and it should pick back up."
      reset={reset}
    />
  )
}
