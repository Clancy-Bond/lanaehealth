'use client'

/*
 * AccountSetupCard
 *
 * Sends the user back through the 7-step onboarding wizard with
 * existing answers pre-filled (?revise=true). Saves overwrite the
 * existing health_profile rows; the wizard does not duplicate.
 *
 * Voice: short, kind, explanatory. The card reassures the user that
 * revising does not erase their data; it just gives them a chance to
 * update it.
 */
import Link from 'next/link'
import { Card } from '@/v2/components/primitives'

export default function AccountSetupCard() {
  return (
    <Card padding="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
        <h3
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-md)',
            fontWeight: 'var(--v2-weight-semibold)',
          }}
        >
          Walk through setup again
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-secondary)',
            lineHeight: 'var(--v2-leading-relaxed)',
          }}
        >
          Revisit the 7-step wizard with your current answers pre-filled.
          Useful after a new diagnosis, a medication change, or just a
          fresh look. Saves overwrite, never duplicate.
        </p>
        <Link
          href="/v2/onboarding/1?revise=true"
          prefetch={false}
          style={{
            alignSelf: 'flex-start',
            background: 'transparent',
            color: 'var(--v2-text-primary)',
            border: '1px solid var(--v2-border-subtle)',
            borderRadius: 'var(--v2-radius-full)',
            padding: 'var(--v2-space-2) var(--v2-space-3)',
            fontSize: 'var(--v2-text-sm)',
            fontWeight: 'var(--v2-weight-medium)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: 'var(--v2-touch-target-min)',
          }}
        >
          Walk through setup again
        </Link>
      </div>
    </Card>
  )
}
