'use client'

/*
 * SkipOnboardingBanner
 *
 * Shown on /v2 home for users who skipped the onboarding wizard
 * (profile.skipped === true && !profile.skipped_dismissed). Two
 * actions:
 *   - "Continue setup" anchor link to /v2/onboarding/1
 *   - "Dismiss" button POSTs /api/v2/onboarding/dismiss-skip-banner
 *     and hides the banner client-side. The dismiss is permanent
 *     (server stores skipped_dismissed=true).
 *
 * Uses the v2 Banner primitive in info intent so it reads as a
 * gentle nudge, not an alarm.
 */
import { useState } from 'react'
import Link from 'next/link'
import { Banner } from '@/v2/components/primitives'

export default function SkipOnboardingBanner() {
  const [hidden, setHidden] = useState(false)
  const [dismissing, setDismissing] = useState(false)

  if (hidden) return null

  async function dismiss() {
    if (dismissing) return
    setDismissing(true)
    // Optimistic hide. Even if the POST fails, the banner stays
    // hidden for this session; the next page load reads server state
    // and decides whether to show it again.
    setHidden(true)
    try {
      await fetch('/api/v2/onboarding/dismiss-skip-banner', { method: 'POST' })
    } catch {
      // Non-fatal. The banner is already hidden client-side.
    }
  }

  return (
    <Banner
      intent="info"
      title="Finish setting up your profile"
      body="A few more taps so the AI knows your conditions, meds, and basics. The more it knows, the better it spots patterns."
      onDismiss={dismiss}
      trailing={
        <Link
          href="/v2/onboarding/1"
          prefetch={false}
          style={{
            background: 'var(--v2-accent-primary)',
            color: 'var(--v2-on-accent)',
            border: 0,
            borderRadius: 'var(--v2-radius-full)',
            padding: 'var(--v2-space-2) var(--v2-space-3)',
            fontSize: 'var(--v2-text-sm)',
            fontWeight: 'var(--v2-weight-semibold)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: 'var(--v2-touch-target-min)',
            whiteSpace: 'nowrap',
          }}
        >
          Continue setup
        </Link>
      }
    />
  )
}
