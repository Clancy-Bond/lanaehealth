'use client'

/*
 * CycleHormoneArc
 *
 * NC's signature educational illustration (frame_0022 / 0025 / 0030):
 * three stylized hormone curves laid over a normalized cycle, with an
 * egg-dot marker at the ovulation moment. Estrogen (purple) climbs
 * through the follicular phase and peaks just before ovulation; LH
 * (blue) spikes sharply at ovulation; Progesterone (pink) climbs
 * through the luteal phase and falls before the next period.
 *
 * The illustration is the strongest single explainer NC ships: a
 * Cycler can see why the algorithm cares about temperature timing,
 * why an LH test 24h before ovulation works, and why mood / energy /
 * skin track the cycle in the same picture. We use it inside the
 * phase explainer (closes Tier 5d of
 * docs/research/cycle-nc-substantive-gaps.md) where the algorithm
 * section now has visual support.
 *
 * The component is presentational only: pure SVG, no data inputs.
 * The current phase is rendered as a translucent vertical band so
 * the reader knows where they are on the picture today.
 */
import type { CyclePhase } from '@/lib/types'

export interface CycleHormoneArcProps {
  /** When set, renders a translucent vertical "you are here" band over the matching phase. */
  highlightPhase?: CyclePhase | null
  /** Pixel width override; defaults to 100% of container. */
  width?: number | string
  /** Pixel height; defaults to 140. */
  height?: number
  /**
   * When true, the `<svg role="img">` and `aria-label` describe the
   * picture for screen readers; when false (e.g. used purely
   * decoratively) the SVG is `aria-hidden`. Defaults to true.
   */
  labeled?: boolean
}

const VB_WIDTH = 320
const VB_HEIGHT = 140

// Phase boundaries inside the viewBox (X coordinates). Mirror the
// 28-day textbook cycle: menstrual 0-5, follicular 5-13, ovulatory
// 13-16, luteal 16-28. Scaled so 28 days == VB_WIDTH.
const X_PER_DAY = VB_WIDTH / 28
const PHASE_BAND_X: Record<CyclePhase, [number, number]> = {
  menstrual: [0, 5 * X_PER_DAY],
  follicular: [5 * X_PER_DAY, 13 * X_PER_DAY],
  ovulatory: [13 * X_PER_DAY, 16 * X_PER_DAY],
  luteal: [16 * X_PER_DAY, 28 * X_PER_DAY],
}

const OVULATION_X = 14 * X_PER_DAY
const BASELINE_Y = 110

// Smooth bezier paths approximating each hormone's canonical shape.
// Y axis is inverted in SVG (0 = top), so higher hormone values are
// SMALLER Y. Curves are normalized to a 0..100 scale relative to
// peak, mapped onto the 30..110 Y range.
const ESTROGEN_PATH =
  'M 0 100 C 30 95, 60 65, 130 30 C 145 28, 160 50, 175 70 C 200 90, 240 75, 320 90'
const LH_PATH =
  'M 0 105 C 50 105, 100 105, 145 100 C 152 50, 165 35, 175 95 C 200 105, 250 105, 320 105'
const PROGESTERONE_PATH =
  'M 0 110 C 60 110, 130 110, 165 95 C 195 75, 220 35, 245 28 C 270 25, 290 60, 320 105'

const ESTROGEN_COLOR = 'var(--v2-phase-luteal, #9B7FE0)' // purple
const LH_COLOR = 'var(--v2-ring-activity, #5DADE6)' // blue
const PROGESTERONE_COLOR = 'var(--v2-phase-menstrual, #E84570)' // NC pink

const PHASE_LABELS: Record<CyclePhase, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulatory: 'Ovulatory',
  luteal: 'Luteal',
}

export default function CycleHormoneArc({
  highlightPhase,
  width = '100%',
  height = VB_HEIGHT,
  labeled = true,
}: CycleHormoneArcProps) {
  const band =
    highlightPhase != null && highlightPhase in PHASE_BAND_X
      ? PHASE_BAND_X[highlightPhase as CyclePhase]
      : null

  const ariaProps = labeled
    ? {
        role: 'img' as const,
        'aria-label':
          'Hormone curves across a cycle: estrogen climbs through follicular and peaks before ovulation; LH spikes at ovulation; progesterone climbs through luteal and falls before the next period.',
      }
    : { 'aria-hidden': true as const }

  return (
    <svg
      viewBox={`0 -10 ${VB_WIDTH} ${VB_HEIGHT + 20}`}
      width={width}
      height={height}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block' }}
      {...ariaProps}
    >
      {/* Phase highlight band. Translucent so the curves stay primary. */}
      {band && (
        <rect
          x={band[0]}
          y={-10}
          width={band[1] - band[0]}
          height={VB_HEIGHT + 20}
          fill="rgba(155, 127, 224, 0.10)"
          rx={4}
        />
      )}

      {/* Cycle baseline. */}
      <line
        x1={0}
        y1={BASELINE_Y}
        x2={VB_WIDTH}
        y2={BASELINE_Y}
        stroke="var(--v2-border-subtle, rgba(255,255,255,0.10))"
        strokeWidth={1}
      />

      {/* Estrogen, drawn first so it sits behind the spikier LH. */}
      <path
        d={ESTROGEN_PATH}
        stroke={ESTROGEN_COLOR}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />

      {/* Progesterone. */}
      <path
        d={PROGESTERONE_PATH}
        stroke={PROGESTERONE_COLOR}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />

      {/* LH, drawn last so its sharp peak sits on top. */}
      <path
        d={LH_PATH}
        stroke={LH_COLOR}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />

      {/* Ovulation marker: small black egg-dot at the LH peak. */}
      <ellipse
        cx={OVULATION_X}
        cy={42}
        rx={4}
        ry={5}
        fill="var(--v2-text-primary, #F2F2F4)"
        stroke="rgba(0,0,0,0.18)"
        strokeWidth={0.5}
      />
      <line
        x1={OVULATION_X}
        y1={48}
        x2={OVULATION_X}
        y2={BASELINE_Y}
        stroke="var(--v2-text-muted, #7E8088)"
        strokeWidth={0.5}
        strokeDasharray="2 3"
      />

      {/* Compact legend at the bottom. */}
      <g transform={`translate(0, ${VB_HEIGHT + 4})`} fontSize={8}>
        <circle cx={4} cy={4} r={3} fill={ESTROGEN_COLOR} />
        <text x={11} y={7} fill="var(--v2-text-secondary)">Estrogen</text>
        <circle cx={70} cy={4} r={3} fill={LH_COLOR} />
        <text x={77} y={7} fill="var(--v2-text-secondary)">LH</text>
        <circle cx={108} cy={4} r={3} fill={PROGESTERONE_COLOR} />
        <text x={115} y={7} fill="var(--v2-text-secondary)">Progesterone</text>
        {highlightPhase && (
          <text
            x={VB_WIDTH}
            y={7}
            textAnchor="end"
            fill="var(--v2-text-muted)"
          >
            {PHASE_LABELS[highlightPhase]} phase
          </text>
        )}
      </g>
    </svg>
  )
}
