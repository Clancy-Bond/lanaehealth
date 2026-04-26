'use client'

/**
 * Step 5: Connect Oura ring
 *
 * Three-state explainer:
 *   - Pitch (icon + 2-line value prop)
 *   - "Connect Oura" CTA -> redirects to /api/oura/authorize, which
 *     sends the user to the Oura OAuth screen and returns to
 *     /api/oura/callback. The callback already redirects back to
 *     the app; once that lands, the user re-enters the wizard at
 *     step 6 via the "Continue" button.
 *   - "Skip for now" CTA -> jumps to step 6 without touching Oura.
 *
 * Note: we do NOT block the wizard on a successful Oura connection.
 * If the OAuth dance fails (token revoked, OAuth misconfigured), the
 * user can still progress; the home screen will surface a "connect
 * Oura" prompt later.
 */
import { useRouter } from 'next/navigation'
import { Button, Card } from '@/v2/components/primitives'
import OnboardingShell from '../../_components/OnboardingShell'
import { STEP_TITLES } from './config'
import type { StepNumber } from './config'

interface StepOuraProps {
  step: StepNumber
  totalSteps: number
  revise?: boolean
}

export default function StepOura({ step, totalSteps, revise = false }: StepOuraProps) {
  const router = useRouter()
  const titleCfg = STEP_TITLES[step]
  const nextSuffix = revise ? '?revise=true' : ''

  function onConnect() {
    // Hard navigation so the OAuth callback returns to the app
    // cleanly. The redirect destination after OAuth is configured
    // server-side; we trust it to land somewhere reasonable.
    window.location.href = '/api/oura/authorize'
  }

  return (
    <OnboardingShell
      step={step}
      totalSteps={totalSteps}
      title={titleCfg.title}
      subtitle={titleCfg.subtitle}
      revise={revise}
      primaryAction={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
          <Button variant="primary" size="lg" fullWidth onClick={onConnect}>
            Connect Oura
          </Button>
          <Button
            variant="secondary"
            size="md"
            fullWidth
            onClick={() => router.push(`/v2/onboarding/6${nextSuffix}`)}
          >
            I don&apos;t have one
          </Button>
        </div>
      }
    >
      <Card>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-3)',
            padding: 'var(--v2-space-2) 0',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-base)',
              color: 'var(--v2-text-primary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            If you wear an Oura ring, connecting it now means your sleep,
            BBT, HRV, and activity show up automatically every morning.
            No tap-tap-typing. The AI uses that signal to spot patterns
            you would never catch alone.
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-muted)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            We only read the metrics you see in the Oura app. No GPS, no
            location, no contacts. You can disconnect any time from
            Settings.
          </p>
        </div>
      </Card>

      <Card variant="explanatory" style={{ marginTop: 'var(--v2-space-4)' }}>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-sm)',
            lineHeight: 'var(--v2-leading-relaxed)',
          }}
        >
          New to Oura? It is a finger ring that measures sleep stages,
          temperature trends, heart rate variability, and resting heart
          rate. Helpful for cycle tracking via overnight basal body
          temperature.
        </p>
      </Card>
    </OnboardingShell>
  )
}
