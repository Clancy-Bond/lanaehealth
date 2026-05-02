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
import { useRouter } from 'next/navigation'
import type { CyclePhase } from '@/lib/types'

export interface NCSymptomChipsProps {
  /** Current calendar phase. Drives which chip set is shown. */
  phase: CyclePhase | null
  /**
   * Optional tap handler. Receives the canonical symptom slug. When
   * omitted, the chip routes to /v2/cycle/log?symptom=<slug> so the
   * log sheet opens with the chosen chip pre-selected. The log page
   * picks up the query param and pre-fills the form.
   */
  onPick?: (slug: string) => void
  /** Optional title override. */
  title?: string
  /**
   * Optional ordered slug list that overrides the default phase-keyed
   * set. Each slug must exist in the exported `CHIPS` map; unknown
   * slugs are skipped silently. Used by section-side wrappers (e.g.
   * `src/app/v2/cycle/_components/PersonalizedSymptomChips.tsx`) to
   * show a Cycler their own most-frequently-logged symptoms in this
   * phase rather than the static phase-typical fallback. NC's actual
   * "Most common symptoms and moods" rail is phase-aware AND
   * user-history-aware; this prop unblocks the latter half without
   * requiring a section-side reimplementation of the chip glyphs.
   */
  slugs?: ReadonlyArray<string>
}

export interface Chip {
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

/*
 * Slug vocabulary alignment.
 *
 * The chip slugs MUST match `SYMPTOM_OPTIONS` in
 * `src/app/v2/cycle/_components/PeriodLogFormV2.tsx` so the
 * `?symptom=<slug>` pre-select actually highlights the chip in the
 * form's SymptomPicker. Form slugs use the more clinical singular
 * form (`cramping` not `cramps`, `bloating` not `bloated`,
 * `fatigue` not `tired`). NC's user-facing labels stay short and
 * non-clinical here ("Cramps", "Tired") -- only the underlying slug
 * matches the form.
 */
export const CHIPS: Record<string, Chip> = {
  cramping: {
    slug: 'cramping',
    label: 'Cramps',
    icon: <Glyph d="M5 12c0-4 3-7 7-7s7 3 7 7-3 7-7 7-7-3-7-7zM9 12c1 1 2 1 3 0M14 12c-1 1-2 1-3 0" />,
  },
  fatigue: {
    slug: 'fatigue',
    label: 'Tired',
    icon: <Glyph d="M21 12.8a9 9 0 1 1-9.6-9.6 7 7 0 0 0 9.6 9.6z" />,
  },
  irritable: {
    slug: 'irritable',
    label: 'PMS',
    icon: <Glyph d="M12 5v14M5 12h14" />,
  },
  sore_breasts: {
    slug: 'sore_breasts',
    label: 'Sore breasts',
    icon: <Glyph d="M6 12c0-3 2.7-5 6-5s6 2 6 5-2.7 5-6 5-6-2-6-5zM12 12v.01" />,
  },
  tender_breasts: {
    slug: 'tender_breasts',
    label: 'Tender breasts',
    icon: <Glyph d="M6 12c0-3 2.7-5 6-5s6 2 6 5-2.7 5-6 5-6-2-6-5z" />,
  },
  low_energy: {
    slug: 'low_energy',
    label: 'Low energy',
    icon: <Glyph d="M12 21s-7-4.35-7-10a4.5 4.5 0 0 1 8-2.83A4.5 4.5 0 0 1 19 11c0 5.65-7 10-7 10z" />,
  },
  insomnia: {
    slug: 'insomnia',
    label: 'Trouble sleeping',
    icon: <Glyph d="M3 12h4l2-3 4 6 2-3h6" />,
  },
  anxious: {
    slug: 'anxious',
    label: 'Anxious',
    icon: <Glyph d="M9 9c0-1 1-2 2-2s2 1 2 2M15 9c0-1 1-2 2-2s2 1 2 2M5 9c0-1 1-2 2-2M8 16c1.2 1 2.6 1.5 4 1.5s2.8-.5 4-1.5" />,
  },
  nausea: {
    slug: 'nausea',
    label: 'Nausea',
    icon: <Glyph d="M5 12a7 7 0 0 1 14 0M8 16q2-1 4 0t4 0" />,
  },
  bloating: {
    slug: 'bloating',
    label: 'Bloated',
    icon: <Glyph d="M5 12c0-4 3-7 7-7s7 3 7 7c0 5-3 8-7 8s-7-3-7-8zM10 11h4M10 14h4" />,
  },
  cravings: {
    slug: 'cravings',
    label: 'Cravings',
    icon: <Glyph d="M12 5c-2 0-4 2-4 4 0 3 4 7 4 7s4-4 4-7c0-2-2-4-4-4zM10 18h4" />,
  },
  backache: {
    slug: 'backache',
    label: 'Backache',
    icon: <Glyph d="M9 4c1 0 2 1 2 2v14M14 6c0 6 2 14 2 14M9 11h6" />,
  },
  headache: {
    slug: 'headache',
    label: 'Headache',
    icon: <Glyph d="M6 11a6 6 0 1 1 12 0v3a3 3 0 0 1-3 3h-1l-1 4-2-3h-2a3 3 0 0 1-3-3z" />,
  },
}

/*
 * Phase-keyed chip sets. Each slug here MUST exist in CHIPS above.
 * The set for each phase mirrors what NC surfaces ("most likely
 * to flare in this phase"): cramps + tired + low energy in
 * menstrual, energy + libido in ovulatory, PMS + bloating in
 * luteal, etc.
 */
const PHASE_CHIP_SETS: Record<NonNullable<CyclePhase>, string[]> = {
  menstrual: ['cramping', 'fatigue', 'low_energy', 'sore_breasts', 'cravings', 'bloating', 'headache', 'backache'],
  follicular: ['fatigue', 'irritable', 'cravings', 'anxious', 'insomnia'],
  ovulatory: ['sore_breasts', 'cramping', 'headache', 'tender_breasts', 'nausea'],
  luteal: ['irritable', 'fatigue', 'sore_breasts', 'bloating', 'cravings', 'cramping', 'headache', 'anxious', 'insomnia'],
}

export default function NCSymptomChips({
  phase,
  onPick,
  title = 'Most common symptoms and moods',
  slugs: customSlugs,
}: NCSymptomChipsProps) {
  const router = useRouter()
  const safePhase: NonNullable<CyclePhase> = phase ?? 'follicular'
  // Custom slug list overrides the default phase-keyed set when
  // provided. Unknown slugs are filtered out so a stale or
  // misconfigured wrapper cannot break the rail.
  const slugs =
    customSlugs && customSlugs.length > 0
      ? customSlugs.filter((s) => s in CHIPS)
      : PHASE_CHIP_SETS[safePhase]

  const handlePick = (slug: string) => {
    if (onPick) {
      onPick(slug)
      return
    }
    // Default: open the cycle log with the chosen chip pre-selected.
    // The log route reads ?symptom=<slug> and pre-fills the form.
    router.push(`/v2/cycle/log?symptom=${encodeURIComponent(slug)}`)
  }

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
              onClick={() => handlePick(chip.slug)}
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
                cursor: 'pointer',
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
