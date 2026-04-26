'use client'

/**
 * Step 1: Welcome
 *
 * Pure read-only landing screen. No DB writes; just sets the user's
 * expectation for the next six steps and gives them a single CTA.
 *
 * The OnboardingHero decorative SVG (PR #84) anchors the screen and
 * carries the warm, hand-drawn aesthetic that distinguishes
 * onboarding from the Oura-derived metric chrome the app uses
 * elsewhere.
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/v2/components/primitives'
import { OnboardingHero } from '@/v2/components/primitives/decorative'
import OnboardingShell from '../../_components/OnboardingShell'
import { STEP_TITLES } from './config'
import type { StepNumber } from './config'

interface StepWelcomeProps {
  step: StepNumber
  totalSteps: number
  firstName: string
  revise?: boolean
}

export default function StepWelcome({ step, totalSteps, firstName, revise = false }: StepWelcomeProps) {
  const router = useRouter()
  const titleCfg = STEP_TITLES[step]
  const nextSuffix = revise ? '?revise=true' : ''

  return (
    <OnboardingShell
      step={step}
      totalSteps={totalSteps}
      title={revise ? `Hi ${firstName}, let's revise.` : `Hi ${firstName}, welcome.`}
      subtitle={titleCfg.subtitle}
      showSkip={false}
      revise={revise}
      primaryAction={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)', width: '100%' }}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => router.push(`/v2/onboarding/2${nextSuffix}`)}
          >
            Let&apos;s go
          </Button>
          {!revise && (
            <p
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-text-muted)',
                textAlign: 'center',
                lineHeight: 'var(--v2-leading-relaxed)',
              }}
            >
              By signing up you agree to our{' '}
              <Link
                href="/v2/legal/terms"
                prefetch={false}
                style={{ color: 'var(--v2-accent-primary)', textDecoration: 'none' }}
              >
                Terms
              </Link>{' '}
              and{' '}
              <Link
                href="/v2/legal/privacy"
                prefetch={false}
                style={{ color: 'var(--v2-accent-primary)', textDecoration: 'none' }}
              >
                Privacy Policy
              </Link>
              .
            </p>
          )}
        </div>
      }
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--v2-space-4)',
          paddingTop: 'var(--v2-space-4)',
        }}
      >
        <OnboardingHero size={220} />
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-3)',
            width: '100%',
            maxWidth: 360,
          }}
        >
          <ValueBullet
            heading="Connect your Oura."
            body="Sleep, BBT, HRV, and activity import every morning."
          />
          <ValueBullet
            heading="Learn your patterns."
            body="The AI watches food, cycle, sleep, and symptoms together so you stop guessing."
          />
          <ValueBullet
            heading="Prep for doctor visits."
            body="One tap turns the last 90 days into a one-page summary you can hand the office."
          />
          <ValueBullet
            heading="Remember corrections forever."
            body="Tell us a number is wrong once and the AI honors it from then on."
          />
        </ul>
      </div>
    </OnboardingShell>
  )
}

function ValueBullet({ heading, body }: { heading: string; body: string }) {
  return (
    <li
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-1)',
      }}
    >
      <span
        style={{
          fontSize: 'var(--v2-text-base)',
          fontWeight: 'var(--v2-weight-semibold)',
          color: 'var(--v2-text-primary)',
        }}
      >
        {heading}
      </span>
      <span
        style={{
          fontSize: 'var(--v2-text-sm)',
          color: 'var(--v2-text-secondary)',
          lineHeight: 'var(--v2-leading-relaxed)',
        }}
      >
        {body}
      </span>
    </li>
  )
}
