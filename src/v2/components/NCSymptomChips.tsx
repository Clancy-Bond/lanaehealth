/*
 * NCSymptomChips
 *
 * Clones the "Most common symptoms and moods" capsule strip seen at
 * the bottom of docs/reference/natural-cycles/frames/full-tour/
 * frame_0010.png. Each chip is a soft-cream pill with a small
 * leading glyph and the label. Tapping a chip opens the period /
 * symptom log via the provided onPick callback.
 *
 * The chip set is phase-aware: NC surfaces the symptoms that are
 * most likely to flare in the current phase (PMS-y stuff in luteal,
 * cramps and fatigue in menstrual, energy and libido in ovulatory).
 *
 * Voice rule: chip labels are short and non-clinical. "Tired" not
 * "Fatigue", "Sore breasts" not "Mastalgia", "Cramps" not
 * "Dysmenorrhea". The clinical mapping happens in the log handler.
 */
'use client'

import type { ReactNode } from 'react'
import type { CyclePhase } from '@/lib/types'

export interface NCSymptomChipsProps {
  /** Current calendar phase. Drives which chip set is shown. */
  phase: CyclePhase | null
  /** Tap handler. Receives the canonical symptom slug. */
  onPick?: (slug: string) => void
  /** Optional title override. */
  title?: string
}

interface Chip {
  slug: string
  label: string
  icon: ReactNode
}

const ICON_COLOR = 'var(--v2-surface-explanatory-text, #2D193C)'

function Glyph({ d }: { d: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={d} stroke={ICON_COLOR} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const CHIPS: Record<string, Chip> = {
  cramps: {
    slug: 'cramps',
    label: 'Cramps',
    icon: <Glyph d="M5 12c0-4 3-7 7-7s7 3 7 7-3 7-7 7-7-3-7-7zM9 12c1 1 2 1 3 0M14 12c-1 1-2 1-3 0" />,
  },
  tired: {
    slug: 'tired',
    label: 'Tired',
    icon: <Glyph d="M21 12.8a9 9 0 1 1-9.6-9.6 7 7 0 0 0 9.6 9.6z" />,
  },
  pms: {
    slug: 'pms',
    label: 'PMS',
    icon: <Glyph d="M12 5v14M5 12h14" />,
  },
  calm: {
    slug: 'calm',
    label: 'Calm',
    icon: <Glyph d="M9 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm6 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM8 15c1.2 1 2.6 1.5 4 1.5s2.8-.5 4-1.5" />,
  },
  sore_breasts: {
    slug: 'sore_breasts',
    label: 'Sore breasts',
    icon: <Glyph d="M6 12c0-3 2.7-5 6-5s6 2 6 5-2.7 5-6 5-6-2-6-5zM12 12v.01" />,
  },
  low_libido: {
    slug: 'low_libido',
    label: 'Low sex drive',
    icon: <Glyph d="M12 21s-7-4.35-7-10a4.5 4.5 0 0 1 8-2.83A4.5 4.5 0 0 1 19 11c0 5.65-7 10-7 10z" />,
  },
  high_libido: {
    slug: 'high_libido',
    label: 'High sex drive',
    icon: <Glyph d="M12 21s-7-4.35-7-10a4.5 4.5 0 0 1 8-2.83A4.5 4.5 0 0 1 19 11c0 5.65-7 10-7 10zM9 12l2 2 4-4" />,
  },
  energetic: {
    slug: 'energetic',
    label: 'Energetic',
    icon: <Glyph d="M13 2L4 14h7l-2 8 9-12h-7l2-8z" />,
  },
  bloated: {
    slug: 'bloated',
    label: 'Bloated',
    icon: <Glyph d="M5 12c0-4 3-7 7-7s7 3 7 7c0 5-3 8-7 8s-7-3-7-8zM10 11h4M10 14h4" />,
  },
  cravings: {
    slug: 'cravings',
    label: 'Cravings',
    icon: <Glyph d="M12 5c-2 0-4 2-4 4 0 3 4 7 4 7s4-4 4-7c0-2-2-4-4-4zM10 18h4" />,
  },
}

const PHASE_CHIP_SETS: Record<NonNullable<CyclePhase>, string[]> = {
  menstrual: ['cramps', 'tired', 'low_libido', 'sore_breasts', 'cravings', 'bloated'],
  follicular: ['energetic', 'calm', 'high_libido', 'tired', 'pms'],
  ovulatory: ['high_libido', 'energetic', 'calm', 'sore_breasts', 'cramps'],
  luteal: ['pms', 'tired', 'sore_breasts', 'bloated', 'cravings', 'cramps'],
}

export default function NCSymptomChips({ phase, onPick, title = 'Most common symptoms and moods' }: NCSymptomChipsProps) {
  const safePhase: NonNullable<CyclePhase> = phase ?? 'follicular'
  const slugs = PHASE_CHIP_SETS[safePhase]

  return (
    <section
      aria-label={title}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-3)',
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-base)',
          fontWeight: 'var(--v2-weight-semibold)',
          color: 'var(--v2-surface-explanatory-text, #2D193C)',
        }}
      >
        {title}
      </h3>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--v2-space-2)',
        }}
      >
        {slugs.map((slug) => {
          const chip = CHIPS[slug]
          if (!chip) return null
          return (
            <button
              key={chip.slug}
              type="button"
              onClick={() => onPick?.(chip.slug)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--v2-space-2)',
                padding: '8px 14px',
                borderRadius: 'var(--v2-radius-full)',
                border: '1px solid var(--v2-surface-explanatory-border, rgba(45, 25, 60, 0.10))',
                background: 'var(--v2-surface-explanatory-secondary, #F4ECF1)',
                color: 'var(--v2-surface-explanatory-text, #2D193C)',
                fontSize: 'var(--v2-text-sm)',
                fontWeight: 'var(--v2-weight-medium)',
                fontFamily: 'inherit',
                cursor: onPick ? 'pointer' : 'default',
                minHeight: 36,
              }}
              aria-label={`Log ${chip.label}`}
            >
              {chip.icon}
              <span>{chip.label}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
