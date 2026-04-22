/*
 * CaloriesLoadError
 *
 * Shared fallback for v2/calories server pages when a loader
 * rejects. Renders inside MobileShell chrome instead of letting
 * Next kick the default error boundary, which would drop the user
 * out of v2 entirely. NC voice: short, kind, explanatory. Tells
 * the user what happened without a stack trace or technical blame.
 */
import Link from 'next/link'
import { Card, Button } from '@/v2/components/primitives'

export interface CaloriesLoadErrorProps {
  /** Optional headline override; defaults to a neutral reload prompt. */
  headline?: string
  /** Optional subtext override. */
  body?: string
  /** Where the retry button points. Defaults to the same v2 path. */
  retryHref?: string
}

export default function CaloriesLoadError({
  headline = "We couldn't load that",
  body = 'Usually a network blip. Try again in a moment.',
  retryHref = '/v2/calories',
}: CaloriesLoadErrorProps) {
  return (
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
      <Link href={retryHref} style={{ textDecoration: 'none' }}>
        <Button variant="primary" size="lg" fullWidth>
          Try again
        </Button>
      </Link>
    </div>
  )
}
