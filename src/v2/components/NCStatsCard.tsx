/*
 * NCStatsCard
 *
 * Mirrors the personal-stat callouts NC scatters across its
 * "phase deep dive" surfaces, e.g.
 * docs/reference/natural-cycles/frames/full-tour/frame_0040.png:
 *
 *   ┌──────────────────────────────────────┐
 *   │  My luteal phase length              │   small caps label
 *   │  15±2 days                           │   big bold value
 *   │  The average luteal phase length for │   muted comparison line
 *   │  all cyclers is 12±2 days.           │
 *   └──────────────────────────────────────┘
 *
 * Used as a content card on the cycle surface (cream NC chrome,
 * not on the dark Oura chrome). Composes well: drop several in a
 * column to mirror NC's stacked stat blocks.
 *
 * Voice rule: labels start with "My" / "Your" so the user owns
 * the number. Comparison lines stay neutral ("for all cyclers")
 * to avoid value judgements.
 */
'use client'

import type { ReactNode } from 'react'

export interface NCStatsCardProps {
  /** Small-caps label above the value ("My luteal phase length"). */
  label: string
  /** Big bold value ("15±2 days", "97.30°F"). ReactNode so callers
   *  can colorize sub-spans. */
  value: ReactNode
  /** Optional muted comparison / context line below the value. */
  comparison?: string
  /** Optional pill rendered to the right of the value
   *  ("Stable" / "Variable" / "+0.41°F"). */
  trailingPill?: { label: string; tone?: 'positive' | 'neutral' | 'warning' }
}

const PILL_TONE: Record<NonNullable<NCStatsCardProps['trailingPill']>['tone'] & string, { bg: string; fg: string }> = {
  positive: {
    bg: 'rgba(93, 188, 130, 0.18)',
    fg: '#2F7A4D',
  },
  neutral: {
    bg: 'var(--v2-surface-explanatory-secondary, #F4ECF1)',
    fg: 'var(--v2-surface-explanatory-text, #2D193C)',
  },
  warning: {
    bg: 'rgba(232, 69, 112, 0.15)',
    fg: '#A0264A',
  },
}

export default function NCStatsCard({ label, value, comparison, trailingPill }: NCStatsCardProps) {
  const pillTone = trailingPill ? PILL_TONE[trailingPill.tone ?? 'neutral'] : null
  return (
    <article
      style={{
        background: 'var(--v2-surface-explanatory-card, #FFFFFF)',
        border: '1px solid var(--v2-surface-explanatory-border, rgba(45, 25, 60, 0.06))',
        borderRadius: 'var(--v2-radius-lg)',
        padding: 'var(--v2-space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-2)',
        color: 'var(--v2-surface-explanatory-text, #2D193C)',
      }}
    >
      <span
        style={{
          fontSize: 'var(--v2-text-xs)',
          fontWeight: 'var(--v2-weight-semibold)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--v2-surface-explanatory-text-muted, rgba(45, 25, 60, 0.6))',
        }}
      >
        {label}
      </span>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 'var(--v2-space-3)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--v2-text-2xl)',
            fontWeight: 'var(--v2-weight-bold)',
            letterSpacing: 'var(--v2-tracking-tight)',
            fontVariantNumeric: 'tabular-nums',
            color: 'var(--v2-surface-explanatory-text, #2D193C)',
          }}
        >
          {value}
        </span>
        {trailingPill && pillTone && (
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--v2-radius-full)',
              background: pillTone.bg,
              color: pillTone.fg,
              fontSize: 'var(--v2-text-xs)',
              fontWeight: 'var(--v2-weight-semibold)',
              letterSpacing: '0.02em',
              flexShrink: 0,
            }}
          >
            {trailingPill.label}
          </span>
        )}
      </div>
      {comparison && (
        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-sm)',
            lineHeight: 'var(--v2-leading-relaxed)',
            color: 'var(--v2-surface-explanatory-text-muted, rgba(45, 25, 60, 0.65))',
          }}
        >
          {comparison}
        </p>
      )}
    </article>
  )
}
