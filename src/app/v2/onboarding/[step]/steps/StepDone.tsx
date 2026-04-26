'use client'

/**
 * Step 7: Done
 *
 * Marks onboarding complete server-side then offers three concrete
 * "what now?" actions. Tapping any of them navigates the user out of
 * the wizard; tapping "See your home" runs the catch-all redirect.
 *
 * The completion POST fires on mount (via useEffect) so even users
 * who close the tab from this screen are marked done. We swallow
 * errors silently here; the next page load will re-bounce them into
 * the wizard if the write actually failed, and they can finish in
 * one more click.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, Card } from '@/v2/components/primitives'
import OnboardingShell from '../../_components/OnboardingShell'
import { STEP_TITLES } from './config'
import type { StepNumber } from './config'

interface StepDoneProps {
  step: StepNumber
  totalSteps: number
  firstName: string
}

export default function StepDone({ step, totalSteps, firstName }: StepDoneProps) {
  const router = useRouter()
  const titleCfg = STEP_TITLES[step]
  const [completing, setCompleting] = useState(true)

  useEffect(() => {
    let cancelled = false
    void fetch('/api/v2/onboarding', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ step: 'complete' }),
    })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setCompleting(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <OnboardingShell
      step={step}
      totalSteps={totalSteps}
      title={`Nice work, ${firstName}.`}
      subtitle={titleCfg.subtitle}
      showSkip={false}
      primaryAction={
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={() => router.push('/v2')}
          disabled={completing}
        >
          See your home
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
        <StarterAction
          href="/v2/log"
          title="Log how you're feeling today"
          body="Two taps for energy, mood, and pain. The AI starts learning from minute one."
        />
        <StarterAction
          href="/v2/chat?starter=summary"
          title="Ask the AI a question"
          body="Try: what does my last week of sleep say about my cycle?"
        />
        <StarterAction
          href="/v2"
          title="See your home"
          body="Live metric strip, primary insight, and fast paths to log or ask."
        />
      </div>
    </OnboardingShell>
  )
}

function StarterAction({
  href,
  title,
  body,
}: {
  href: string
  title: string
  body: string
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-1)' }}>
          <span
            style={{
              fontSize: 'var(--v2-text-base)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
            }}
          >
            {title}
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
        </div>
      </Card>
    </Link>
  )
}
