'use client'

/*
 * ErrorState
 *
 * Shared shell for v2 Next.js error.tsx boundaries. Stays inside
 * v2 chrome (MobileShell + TopAppBar) so a transient failure does
 * not drop the reader out of the app entirely. NC voice: short,
 * kind, explanatory. No stack traces in the headline.
 *
 * Mirrors the shape of CaloriesLoadError but accepts a `reset`
 * callback (the Next.js error boundary prop) instead of a retry
 * link. Use this from any /v2 *error.tsx file.
 */
import { Card, Button } from '@/v2/components/primitives'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import type { ReactNode } from 'react'

export interface ErrorStateProps {
  /** Title that appears in the TopAppBar; matches the page the user was on. */
  title: ReactNode
  /** Headline inside the card. Defaults to a neutral reload prompt. */
  headline?: string
  /** Body inside the card. Defaults to a neutral reload prompt. */
  body?: string
  /** Optional leading action in the TopAppBar (e.g. a back arrow). */
  topLeading?: ReactNode
  /** Next.js error boundary reset callback. */
  reset: () => void
}

export default function ErrorState({
  title,
  headline = "Something interrupted the connection",
  body = 'This usually clears in a moment. Try again, and if it persists, the data is still safe in your records.',
  topLeading,
  reset,
}: ErrorStateProps) {
  return (
    <MobileShell top={<TopAppBar variant="large" title={title} leading={topLeading} />}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-4)',
          padding: 'var(--v2-space-4)',
          paddingBottom: 'var(--v2-space-8)',
          maxWidth: 640,
          margin: '0 auto',
          width: '100%',
        }}
      >
        <Card variant="explanatory" padding="md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
            <h2
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-lg)',
                fontWeight: 'var(--v2-weight-semibold)',
              }}
            >
              {headline}
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-sm)',
                lineHeight: 'var(--v2-leading-relaxed)',
              }}
            >
              {body}
            </p>
          </div>
        </Card>
        <Button variant="primary" size="lg" fullWidth onClick={reset}>
          Try again
        </Button>
      </div>
    </MobileShell>
  )
}
