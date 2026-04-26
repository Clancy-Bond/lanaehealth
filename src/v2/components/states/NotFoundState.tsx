/*
 * NotFoundState
 *
 * Shared shell for v2 Next.js not-found.tsx surfaces. Stays inside
 * v2 chrome (MobileShell + TopAppBar) so a wrong URL does not drop
 * the reader out of the app entirely. NC voice: short, kind, with
 * a clear next step.
 *
 * Three actions surfaced:
 *   1. Go home (primary, /v2)
 *   2. Try the chat (secondary, /v2/chat)
 *   3. Report this so we can fix it (tertiary, mailto fallback)
 */
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Card, Button } from '@/v2/components/primitives'
import { MobileShell, TopAppBar } from '@/v2/components/shell'

export interface NotFoundStateProps {
  /** Title that appears in the TopAppBar. Defaults to a generic page label. */
  title?: ReactNode
  /** Headline inside the card. Defaults to a generic not-found message. */
  headline?: string
  /** Body inside the card. Defaults to NC voice copy. */
  body?: string
}

export default function NotFoundState({
  title = 'Page not found',
  headline = "We couldn't find what you were looking for",
  body = "The page may have moved, or the link might be from an older version. Let's get you somewhere familiar.",
}: NotFoundStateProps) {
  return (
    <MobileShell top={<TopAppBar variant="large" title={title} />}>
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
        data-testid="v2-not-found"
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
          <Link href="/v2" style={{ textDecoration: 'none' }} data-testid="v2-not-found-home">
            <Button variant="primary" size="lg" fullWidth>
              Go to home
            </Button>
          </Link>
          <Link href="/v2/chat" style={{ textDecoration: 'none' }} data-testid="v2-not-found-chat">
            <Button variant="secondary" size="lg" fullWidth>
              Ask the AI assistant instead
            </Button>
          </Link>
          <a
            href="mailto:support@lanaehealth.app?subject=Broken%20link%20in%20LanaeHealth"
            style={{ textDecoration: 'none' }}
            data-testid="v2-not-found-report"
          >
            <Button variant="tertiary" size="md" fullWidth>
              Report this so we can fix it
            </Button>
          </a>
        </div>
      </div>
    </MobileShell>
  )
}
