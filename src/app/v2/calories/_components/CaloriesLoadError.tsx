'use client'

/*
 * CaloriesLoadError
 *
 * Shared recovery surface for the v2/calories route tree. Rendered from each
 * route's error.tsx boundary when a server component throws (network blip,
 * PostgREST 5xx, service-role key rotation, etc.). Keeps the v2 chrome so the
 * patient never sees Next's default error shell.
 *
 * Voice rules (per CLAUDE.md):
 *  - short, kind, explanatory
 *  - no em-dashes
 *  - no "Error:" prefix, no exception message reflected to the user
 *
 * The explanatory Card variant switches the surface to the cream/blush Warm
 * Modern palette, which CLAUDE.md reserves for educational/supportive content.
 * That palette fits a "we couldn't load this, here's what to do" state better
 * than the Oura-dark default chrome.
 */
import { useEffect } from 'react'
import { MobileShell } from '@/v2/components/shell'
import { Button, Card } from '@/v2/components/primitives'

export interface CaloriesLoadErrorProps {
  error: Error & { digest?: string }
  reset: () => void
  title: string
  body: string
}

export default function CaloriesLoadError({ error, reset, title, body }: CaloriesLoadErrorProps) {
  useEffect(() => {
    // Surface to the dev console so we can diagnose, but never reflect the
    // exception message into the patient-facing UI.
    console.error('[v2/calories] load error', error)
  }, [error])

  return (
    <MobileShell>
      <div
        style={{
          padding: 'var(--v2-space-6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-4)',
          minHeight: '100%',
          justifyContent: 'center',
        }}
      >
        <Card variant="explanatory" padding="lg">
          <h1
            style={{
              fontSize: 'var(--v2-text-lg)',
              fontWeight: 'var(--v2-weight-semibold)',
              margin: 0,
              marginBottom: 'var(--v2-space-3)',
            }}
          >
            {title}
          </h1>
          <p
            style={{
              fontSize: 'var(--v2-text-base)',
              lineHeight: 1.5,
              margin: 0,
              marginBottom: 'var(--v2-space-5)',
            }}
          >
            {body}
          </p>
          <Button variant="primary" onClick={() => reset()}>
            Try again
          </Button>
        </Card>
      </div>
    </MobileShell>
  )
}
