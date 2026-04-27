/*
 * NCPhaseInsightCard
 *
 * Clones the top white card from
 * docs/reference/natural-cycles/frames/full-tour/frame_0010.png:
 *
 *   ┌─────────────────────────────────────────┐
 *   │  Progesterone power                     │  bold headline
 *   │  Progesterone is at its peak, which can │  body paragraph (3-4 lines)
 *   │  promote feelings of calmness and       │
 *   │  relaxation. ...                        │
 *   │                                         │
 *   │                       ┌────────────┐    │
 *   │                       │ Full graph >│    │  outline pill, purple
 *   │                       └────────────┘    │
 *   └─────────────────────────────────────────┘
 *
 * NC swaps the headline + body per phase (and per signal of interest:
 * progesterone in luteal, estrogen surge in late follicular, etc.).
 * We wire phase-keyed defaults here and let callers override the
 * headline + body when a more specific insight is available (e.g.
 * "Your BBT just dropped 0.4°F" when the cycle engine spots it).
 *
 * The "Full graph >" pill defaults to /v2/cycle/insights, which is
 * where the BBT chart + hormone-trajectory timeline live.
 */
'use client'

import Link from 'next/link'
import type { CyclePhase } from '@/lib/types'

export interface NCPhaseInsightCardProps {
  /** Current calendar phase. Drives the default headline + body. */
  phase: CyclePhase | null
  /** Headline override. */
  title?: string
  /** Body override. Plain text; rendered with relaxed line height. */
  body?: string
  /** Pill destination. Defaults to /v2/cycle/insights. */
  graphHref?: string
  /** Pill label override. */
  graphLabel?: string
}

const DEFAULT_INSIGHT: Record<NonNullable<CyclePhase>, { title: string; body: string }> = {
  menstrual: {
    title: 'Resetting time',
    body: "Estrogen and progesterone are at their lowest. Energy may dip and cravings can show up. Honor what your body needs today.",
  },
  follicular: {
    title: 'Estrogen rising',
    body: 'Estrogen is climbing, which often lifts mood and energy. This is a good window for new projects, harder workouts, and social plans.',
  },
  ovulatory: {
    title: 'Peak window',
    body: 'Estrogen and luteinizing hormone are at their peak. Many people feel their most social and athletic during these few days.',
  },
  luteal: {
    title: 'Progesterone power',
    body: 'Progesterone is at its peak, which can promote feelings of calmness and relaxation. You might notice some changes in your appetite or sleep patterns. Focus on self-care and stress management.',
  },
}

export default function NCPhaseInsightCard({
  phase,
  title,
  body,
  graphHref = '/v2/cycle/insights',
  graphLabel = 'Full graph',
}: NCPhaseInsightCardProps) {
  const safePhase: NonNullable<CyclePhase> = phase ?? 'follicular'
  const insight = DEFAULT_INSIGHT[safePhase]
  const finalTitle = title ?? insight.title
  const finalBody = body ?? insight.body

  return (
    <article
      aria-label={`Phase insight: ${finalTitle}`}
      style={{
        background: 'var(--v2-surface-explanatory-card, #FFFFFF)',
        border: '1px solid var(--v2-surface-explanatory-border, rgba(45, 25, 60, 0.06))',
        borderRadius: 'var(--v2-radius-lg)',
        padding: 'var(--v2-space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-3)',
        color: 'var(--v2-surface-explanatory-text, #2D193C)',
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-xl)',
          fontWeight: 'var(--v2-weight-bold)',
          letterSpacing: 'var(--v2-tracking-tight)',
          color: 'var(--v2-surface-explanatory-text, #2D193C)',
        }}
      >
        {finalTitle}
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-sm)',
          lineHeight: 'var(--v2-leading-relaxed)',
          color: 'var(--v2-surface-explanatory-text-muted, rgba(45, 25, 60, 0.75))',
        }}
      >
        {finalBody}
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Link
          href={graphHref}
          prefetch={false}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--v2-space-2)',
            padding: '8px 16px',
            borderRadius: 'var(--v2-radius-full)',
            border: '1.5px solid var(--v2-surface-explanatory-cta, #5B2852)',
            background: 'transparent',
            color: 'var(--v2-surface-explanatory-cta, #5B2852)',
            fontSize: 'var(--v2-text-sm)',
            fontWeight: 'var(--v2-weight-semibold)',
            textDecoration: 'none',
            minHeight: 36,
          }}
        >
          <span>{graphLabel}</span>
          <Chevron />
        </Link>
      </div>
    </article>
  )
}

function Chevron() {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M4 2l4 4-4 4"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
