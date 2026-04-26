'use client'

/**
 * OnboardingShell
 *
 * Shared chrome for every onboarding step: progress dots, page
 * heading, scroll region, primary action button, and a quiet
 * "Skip for now" link in the footer.
 *
 * Uses the v2 dark palette by default; the OnboardingHero decorative
 * SVG (PR #84) is reserved for the welcome step. Other steps use
 * just the progress dots so attention stays on the form.
 *
 * No em-dashes anywhere in user-facing copy.
 */
import type { ReactNode } from 'react'
import Link from 'next/link'

export interface OnboardingShellProps {
  step: number
  totalSteps: number
  title: string
  subtitle?: string
  children: ReactNode
  /** Footer slot; usually a primary "Continue" button. */
  primaryAction?: ReactNode
  /** Hide the "Skip" link on the very first or last step. */
  showSkip?: boolean
}

export default function OnboardingShell({
  step,
  totalSteps,
  title,
  subtitle,
  children,
  primaryAction,
  showSkip = true,
}: OnboardingShellProps) {
  return (
    <main
      className="v2"
      style={{
        minHeight: '100vh',
        background: 'var(--v2-bg-primary)',
        color: 'var(--v2-text-primary)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          padding: 'calc(env(safe-area-inset-top, 0px) + var(--v2-space-4)) var(--v2-space-5) var(--v2-space-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-3)',
        }}
      >
        <ProgressDots current={step} total={totalSteps} />
        <h1
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-2xl)',
            fontWeight: 'var(--v2-weight-semibold)',
            letterSpacing: '-0.02em',
            color: 'var(--v2-text-primary)',
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-base)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            {subtitle}
          </p>
        )}
      </header>

      <section
        style={{
          flex: 1,
          padding: '0 var(--v2-space-5) var(--v2-space-6)',
          overflowY: 'auto',
        }}
      >
        {children}
      </section>

      <footer
        style={{
          padding: 'var(--v2-space-4) var(--v2-space-5) calc(env(safe-area-inset-bottom, 0px) + var(--v2-space-5))',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-3)',
          borderTop: '1px solid var(--v2-border-subtle)',
          background: 'var(--v2-bg-primary)',
        }}
      >
        {primaryAction}
        {showSkip && (
          <Link
            href="/api/v2/onboarding/skip"
            prefetch={false}
            style={{
              alignSelf: 'center',
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-muted)',
              textDecoration: 'none',
              padding: 'var(--v2-space-2) var(--v2-space-4)',
            }}
          >
            Skip for now
          </Link>
        )}
      </footer>
    </main>
  )
}

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`Step ${current} of ${total}`}
      style={{
        display: 'flex',
        gap: 'var(--v2-space-1)',
        alignItems: 'center',
      }}
    >
      {Array.from({ length: total }, (_, i) => {
        const idx = i + 1
        const filled = idx <= current
        return (
          <span
            key={idx}
            aria-hidden
            style={{
              flex: 1,
              height: 4,
              borderRadius: 'var(--v2-radius-full)',
              background: filled ? 'var(--v2-accent-primary)' : 'var(--v2-border)',
              transition: 'background var(--v2-duration-medium) var(--v2-ease-standard)',
            }}
          />
        )
      })}
    </div>
  )
}
