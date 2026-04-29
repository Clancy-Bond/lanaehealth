/*
 * NCPhaseCard
 *
 * 1:1 clone of the Natural Cycles "CYCLE PHASE" card seen in
 * docs/reference/natural-cycles/frames/full-tour/frame_0010.png.
 *
 * Anatomy (top to bottom, left to right):
 *
 *   ┌─────────────────────────────────────────┐
 *   │  CYCLE PHASE                       ◯ ── │  small caps, then phase label
 *   │  Luteal                          rim    │  big bold headline / small ring at right
 *   │  ┌─────────────────────────────────┐    │
 *   │  │ 🏃  Exercise                    │    │  inner cream block
 *   │  │     ...one-line guidance.       │    │
 *   │  │                                 │    │
 *   │  │ 🍇  Nutrition                   │    │
 *   │  │     ...one-line guidance.       │    │
 *   │  └─────────────────────────────────┘    │
 *   └─────────────────────────────────────────┘
 *
 * Surface and palette: this card lives on the explanatory cream
 * surface introduced for cycle/onboarding/educational copy
 * (`--v2-surface-explanatory-*` tokens, `.v2-surface-explanatory`
 * utility). The card itself is white with a soft border; the inner
 * block is the surface-secondary cream so the layered look matches
 * NC's two-tone hierarchy.
 *
 * The ring at the top right is a stripped-down chart showing the
 * three hormone signals NC's brand uses (estrogen / LH / progesterone)
 * as colored arcs. We do not have those numerically, so we render
 * a static phase-coloured arc indicator that mirrors the visual
 * weight without claiming hormone data we do not own.
 *
 * Voice rule: NC's Today copy is short, kind, and reads like a
 * trusted friend. Each guidance line is one sentence, second person.
 */
'use client'

import type { ReactNode } from 'react'
import type { CyclePhase } from '@/lib/types'

export interface PhaseGuidance {
  /** Heading rendered next to the leading icon. */
  title: string
  /** One-sentence body. Wraps to two lines max. */
  body: string
}

export interface NCPhaseCardProps {
  /** Current calendar phase. Drives the headline, the ring tint, and
   *  the default guidance pair when no overrides are passed. */
  phase: CyclePhase | null
  /** Phase headline override (defaults to the standard NC label). */
  label?: string
  /** Optional override for the exercise / nutrition guidance copy. */
  exercise?: PhaseGuidance
  nutrition?: PhaseGuidance
  /** Optional trailing slot under the card title (e.g. cycle day pill). */
  trailing?: ReactNode
}

const PHASE_LABELS: Record<NonNullable<CyclePhase>, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulatory: 'Ovulatory',
  luteal: 'Luteal',
}

// Phase colors are the NC palette mapped onto our existing cycle
// chrome variables so the card always inherits theme-aware tones.
const PHASE_RING_COLOR: Record<NonNullable<CyclePhase>, string> = {
  menstrual: 'var(--v2-phase-menstrual, #E84570)',
  follicular: 'var(--v2-phase-follicular, #4DB8A8)',
  ovulatory: 'var(--v2-phase-ovulatory, #E5C952)',
  luteal: 'var(--v2-phase-luteal, #9B7FE0)',
}

const DEFAULT_GUIDANCE: Record<NonNullable<CyclePhase>, { exercise: PhaseGuidance; nutrition: PhaseGuidance }> = {
  menstrual: {
    exercise: {
      title: 'Exercise',
      body: 'Gentle walks, light yoga, or rest. Honor what your body needs.',
    },
    nutrition: {
      title: 'Nutrition',
      body: 'Iron-rich foods help replenish what you lose. Pair with vitamin C.',
    },
  },
  follicular: {
    exercise: {
      title: 'Exercise',
      body: 'Energy is climbing. Strength work or longer cardio feels good now.',
    },
    nutrition: {
      title: 'Nutrition',
      body: 'Lean protein and complex carbs fuel the building phase well.',
    },
  },
  ovulatory: {
    exercise: {
      title: 'Exercise',
      body: 'Your peak window. High-intensity sessions, sprints, group classes.',
    },
    nutrition: {
      title: 'Nutrition',
      body: 'Extra fluids and electrolytes. Antioxidant-rich foods help recovery.',
    },
  },
  luteal: {
    exercise: {
      title: 'Exercise',
      body: 'Moderate movement is best. Cycling, swimming, or steady walks.',
    },
    nutrition: {
      title: 'Nutrition',
      body: 'Fiber-rich foods, hydration, and electrolytes ease PMS symptoms.',
    },
  },
}

export default function NCPhaseCard({
  phase,
  label,
  exercise,
  nutrition,
  trailing,
}: NCPhaseCardProps) {
  const safePhase: NonNullable<CyclePhase> = phase ?? 'follicular'
  const headline = label ?? PHASE_LABELS[safePhase]
  const guidance = DEFAULT_GUIDANCE[safePhase]
  const ex = exercise ?? guidance.exercise
  const nu = nutrition ?? guidance.nutrition
  const ringColor = PHASE_RING_COLOR[safePhase]

  return (
    <article
      aria-label={`Cycle phase: ${headline}`}
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
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 'var(--v2-space-3)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-1)' }}>
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              fontWeight: 'var(--v2-weight-semibold)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--v2-surface-explanatory-text-muted, rgba(45, 25, 60, 0.6))',
            }}
          >
            Cycle phase
          </span>
          <h2
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-2xl)',
              fontWeight: 'var(--v2-weight-bold)',
              letterSpacing: 'var(--v2-tracking-tight)',
              color: 'var(--v2-surface-explanatory-text, #2D193C)',
            }}
          >
            {headline}
          </h2>
          {trailing}
        </div>
        <PhaseRing phase={safePhase} />
      </header>

      <div
        style={{
          background: 'var(--v2-surface-explanatory-secondary, #F4ECF1)',
          borderRadius: 'var(--v2-radius-md)',
          padding: 'var(--v2-space-3) var(--v2-space-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-3)',
        }}
      >
        <GuidanceRow
          icon={<ExerciseGlyph color={ringColor} />}
          title={ex.title}
          body={ex.body}
        />
        <GuidanceRow
          icon={<NutritionGlyph color={ringColor} />}
          title={nu.title}
          body={nu.body}
        />
      </div>
    </article>
  )
}

interface GuidanceRowProps {
  icon: ReactNode
  title: string
  body: string
}

function GuidanceRow({ icon, title, body }: GuidanceRowProps) {
  return (
    <div style={{ display: 'flex', gap: 'var(--v2-space-3)' }}>
      <div style={{ flexShrink: 0, paddingTop: 2 }}>{icon}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span
          style={{
            fontSize: 'var(--v2-text-sm)',
            fontWeight: 'var(--v2-weight-semibold)',
            color: 'var(--v2-surface-explanatory-text, #2D193C)',
          }}
        >
          {title}
        </span>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-sm)',
            lineHeight: 'var(--v2-leading-relaxed)',
            color: 'var(--v2-surface-explanatory-text-muted, rgba(45, 25, 60, 0.7))',
          }}
        >
          {body}
        </p>
      </div>
    </div>
  )
}

/*
 * Hormone-arc ring at the top right of the phase card.
 *
 * Mirrors NC's small ring (frame_0050) which renders three concentric
 * arcs -- one each for the dominant hormones NC's brand surfaces:
 *   - Estrogen (blue) - inner arc
 *   - Luteinizing hormone (green) - middle arc
 *   - Progesterone (purple) - outer arc
 *
 * Each arc length tracks the hormone's typical relative magnitude at
 * the current cycle phase per the NC published methodology:
 *   - Menstrual:   all three at low baseline
 *   - Follicular:  estrogen climbing, LH + progesterone low
 *   - Ovulatory:   estrogen peak, LH spike, progesterone starting
 *   - Luteal:      progesterone peak, estrogen mid, LH low
 *
 * The colored dot in the center is the dominant hormone for the
 * phase so the user gets a one-glance read of "what's running the
 * show right now." We do NOT claim measured hormone data here -- the
 * arcs are visual mirrors of the NC algorithm's expected curve, not
 * the user's actual numbers.
 *
 * The `color` prop is retained for back-compat (the dominant hormone
 * tint) but the three arcs use fixed NC palette regardless of phase,
 * matching how NC always renders all three colors.
 */
const HORMONE_COLOR = {
  estrogen: '#3B82F6',     // NC blue
  lh: '#22C55E',           // NC green
  progesterone: '#9B7FE0', // NC plum-purple
}

const PHASE_HORMONE_LEVELS: Record<NonNullable<CyclePhase>, { estrogen: number; lh: number; progesterone: number; dominant: keyof typeof HORMONE_COLOR }> = {
  menstrual:   { estrogen: 0.18, lh: 0.12, progesterone: 0.10, dominant: 'estrogen' },
  follicular:  { estrogen: 0.62, lh: 0.20, progesterone: 0.15, dominant: 'estrogen' },
  ovulatory:   { estrogen: 0.95, lh: 0.85, progesterone: 0.30, dominant: 'lh' },
  luteal:      { estrogen: 0.45, lh: 0.18, progesterone: 0.85, dominant: 'progesterone' },
}

function PhaseRing({ phase }: { phase: NonNullable<CyclePhase> }) {
  const levels = PHASE_HORMONE_LEVELS[phase]
  const RADII = { estrogen: 13, lh: 17, progesterone: 21 }
  const STROKE = 2.5

  const arc = (radius: number, fraction: number, color: string) => {
    const c = 2 * Math.PI * radius
    return (
      <>
        <circle
          cx={26}
          cy={26}
          r={radius}
          fill="none"
          stroke="var(--v2-surface-explanatory-secondary, #F4ECF1)"
          strokeWidth={STROKE}
        />
        <circle
          cx={26}
          cy={26}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - fraction)}
          transform="rotate(-90 26 26)"
        />
      </>
    )
  }

  return (
    <svg
      width={52}
      height={52}
      viewBox="0 0 52 52"
      role="img"
      aria-label={`${phase} hormone trajectory: estrogen, LH, progesterone`}
      style={{ flexShrink: 0 }}
    >
      {arc(RADII.estrogen, levels.estrogen, HORMONE_COLOR.estrogen)}
      {arc(RADII.lh, levels.lh, HORMONE_COLOR.lh)}
      {arc(RADII.progesterone, levels.progesterone, HORMONE_COLOR.progesterone)}
      {/* Center dot tinted to the dominant hormone for the current phase. */}
      <circle cx={26} cy={26} r={3} fill={HORMONE_COLOR[levels.dominant]} />
    </svg>
  )
}

function ExerciseGlyph({ color }: { color: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx={17} cy={5} r={2.2} fill={color} />
      <path
        d="M8 22l2-6 4-1 3 4M6 13l3-3 4 1"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function NutritionGlyph({ color }: { color: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 4c-2 0-3.5 1.5-3.5 3.5 0 1 .5 2 1.5 2.5-1 .5-1.5 1.5-1.5 2.5 0 2 1.5 3.5 3.5 3.5s3.5-1.5 3.5-3.5c0-1-.5-2-1.5-2.5 1-.5 1.5-1.5 1.5-2.5C15.5 5.5 14 4 12 4z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 16v4" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  )
}
