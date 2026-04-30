'use client'

/**
 * PhaseExplainer
 *
 * Tap-to-explain modal for the cycle phase label inside the hero ring.
 * Closes Tier 4a from docs/research/cycle-nc-substantive-gaps.md: NC's
 * phase explainer sheet (frame_0018-0030) uses a four-section IA that
 * builds trust by walking the reader through the biology before
 * describing what the algorithm does with it.
 *
 *   1. Definition. Plain-language description of what the phase is.
 *   2. Hormones. The hormonal narrative for this phase, named so the
 *      reader can recognize words from their own labs.
 *   3. How to make the most of this phase. Behavioral cues phrased as
 *      observations, not prescriptions.
 *   4. <Phase> phase & the algorithm. How LanaeHealth uses this phase
 *      to compute fertility and predictions. NC's "show your work"
 *      pattern; we mirror it because it is the strongest single trust-
 *      builder in their entire surface.
 *
 * When the phase is unknown the modal falls back to the four-phase
 * overview pattern (the previous content) so the user still gets a
 * useful answer.
 */
import ExplainerSheet from '../../../_components/ExplainerSheet'
import type { CyclePhase } from '@/lib/types'

export interface PhaseExplainerProps {
  open: boolean
  onClose: () => void
  phase: CyclePhase | null | undefined
  day: number | null | undefined
}

const PHASE_LABEL: Record<CyclePhase, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulatory: 'Ovulatory',
  luteal: 'Luteal',
}

interface PhaseSections {
  /** Plain-language phase definition. ~2 sentences. */
  definition: string
  /** Hormonal narrative for this phase. Names the hormones explicitly. */
  hormones: string
  /** Behavioral observations. Phrased as patterns the reader may notice. */
  behaviors: string[]
  /** How the algorithm uses this phase. Mirrors NC's "show your work" pattern. */
  algorithm: string
}

const PHASE_CONTENT: Record<CyclePhase, PhaseSections> = {
  menstrual: {
    definition:
      'The bleed itself, usually three to seven days at the start of a new cycle. Hormones are at their lowest point in the entire cycle, which is why energy can dip and cravings can show up.',
    hormones:
      'Estrogen and progesterone bottom out as the prior cycle ends, which triggers the period. The pituitary starts releasing follicle-stimulating hormone (FSH) toward the end of bleeding, which kicks off the next follicular phase.',
    behaviors: [
      'Rest counts as work in this phase. Softer days are biologically expected, not a moral failing.',
      'Heat (a warm compress, a bath) eases cramping without medication.',
      'Iron-forward food (leafy greens, lentils, red meat) helps replenish what flow takes.',
    ],
    algorithm:
      'LanaeHealth marks days 1 to 5 of bleeding as not fertile by default, regardless of recent variability, because ovulation this early in a cycle is biologically implausible. Logging the start date of bleeding is the single highest-leverage data point you can give the algorithm: every downstream prediction is anchored to it.',
  },
  follicular: {
    definition:
      'The stretch from the end of bleeding to ovulation, roughly days 6 to 13 in a 28-day cycle. The body is growing the follicle that will eventually release an egg.',
    hormones:
      'Estrogen rises through this phase as the follicle develops. Mood and stamina often climb with it. Toward the end of follicular, a sharp luteinizing hormone (LH) surge from the pituitary triggers ovulation.',
    behaviors: [
      'Focus and energy often peak here. Good days for deep work and new plans.',
      'Strength training and longer movement sessions tend to feel better.',
      'Lean protein and dark greens fuel the climb.',
    ],
    algorithm:
      'The follicular window is when the algorithm watches for the LH surge. A positive ovulation test logged here narrows the prediction; once a sustained temperature shift confirms ovulation, the cycle moves into the luteal phase and predictions sharpen.',
  },
  ovulatory: {
    definition:
      'The few days around the release of an egg, roughly days 13 to 16 in a 28-day cycle. Sperm survive up to five days, so the fertile window is wider than just the day of ovulation itself.',
    hormones:
      'Estrogen peaks just before the LH surge that releases the egg. Progesterone starts to climb after ovulation. Some notice a mid-cycle twinge (mittelschmerz); most feel their most social.',
    behaviors: [
      'Sustained estrogen tends to make conversations and meetings flow more easily.',
      'High-output movement (sprints, heavy lifts, group classes) suits this window.',
      'Extra heat and sweat from higher metabolic rate mean more fluids than usual.',
    ],
    algorithm:
      'Ovulation confirmation requires two to four sustained temperatures above your personal cover line, not a single high reading. Until that confirmation lands, the algorithm assumes you may be fertile. Once it confirms, the rest of the cycle becomes predictable.',
  },
  luteal: {
    definition:
      'The back half of the cycle, from ovulation to the next period. Roughly days 17 to 28 in a 28-day cycle. The corpus luteum (what is left of the released follicle) produces progesterone.',
    hormones:
      'Progesterone is high and steady through most of the luteal phase. Body temperature edges up by 0.4 to 0.8 degrees Fahrenheit and stays there. As the phase ends, both estrogen and progesterone drop, which triggers the next period and is also a common trigger for menstrual migraine.',
    behaviors: [
      'Steady pacing tends to beat intense pushes. Afternoons can feel softer than mornings.',
      'Walking, yoga, and stretching often feel better than high-intensity cardio.',
      'Warm grounding meals (roasted vegetables, whole grains, magnesium-rich food) help.',
    ],
    algorithm:
      'The luteal phase length is unusually stable cycle to cycle (about 12 to 14 days for most people). Once ovulation is confirmed, the algorithm uses your personal luteal length to predict your next period much more precisely than the calendar-only estimate from earlier in the cycle.',
  },
}

export default function PhaseExplainer({ open, onClose, phase, day }: PhaseExplainerProps) {
  const title = phase ? `${PHASE_LABEL[phase]} phase` : 'Cycle phase'
  const hasDay = typeof day === 'number' && Number.isFinite(day)

  const sourceNote = phase
    ? hasDay
      ? `Estimated from your logged period start and your typical cycle length. Today is day ${day}, which usually falls in the ${PHASE_LABEL[phase].toLowerCase()} window.`
      : `Estimated from your logged period start and your typical cycle length.`
    : 'No phase yet. Log a period start to begin estimating phase windows.'

  // No-phase fallback keeps the original four-phase overview so the
  // explainer still answers a useful question pre-first-period.
  if (!phase) {
    return (
      <ExplainerSheet open={open} onClose={onClose} title={title} source={sourceNote}>
        <p style={{ margin: 0 }}>
          The cycle is conventionally split into four phases. Each one has a different
          hormone profile, which often shows up in how you feel.
        </p>
        <p style={{ margin: 0 }}>
          <strong>Menstrual</strong> covers the bleed itself, usually days 1 to 5.
          <br />
          <strong>Follicular</strong> runs from the end of bleeding up to ovulation,
          roughly days 6 to 13.
          <br />
          <strong>Ovulatory</strong> is the few days around the release of an egg,
          roughly days 13 to 16.
          <br />
          <strong>Luteal</strong> is the back half of the cycle until the next period,
          roughly days 17 to 28.
        </p>
        <p style={{ margin: 0 }}>
          <strong>How we compute it:</strong> phase is estimated from your cycle day and
          your recent average length. If your cycles vary a lot, the boundary between
          phases is approximate, not a precise medical reading.
        </p>
      </ExplainerSheet>
    )
  }

  const sections = PHASE_CONTENT[phase]

  return (
    <ExplainerSheet open={open} onClose={onClose} title={title} source={sourceNote}>
      {/* Section 1: definition. */}
      <p style={{ margin: 0 }}>{sections.definition}</p>

      {/* Section 2: hormones. */}
      <div>
        <h3
          style={{
            margin: '0 0 var(--v2-space-1)',
            fontSize: 'var(--v2-text-md)',
            fontWeight: 'var(--v2-weight-semibold)',
            color: 'inherit',
          }}
        >
          {"What's happening with hormones"}
        </h3>
        <p style={{ margin: 0 }}>{sections.hormones}</p>
      </div>

      {/* Section 3: behavior tips, framed as observations not prescriptions. */}
      <div>
        <h3
          style={{
            margin: '0 0 var(--v2-space-1)',
            fontSize: 'var(--v2-text-md)',
            fontWeight: 'var(--v2-weight-semibold)',
            color: 'inherit',
          }}
        >
          How to make the most of this phase
        </h3>
        <ul
          style={{
            margin: 0,
            paddingLeft: 'var(--v2-space-5)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-1)',
          }}
        >
          {sections.behaviors.map((b) => (
            <li key={b} style={{ lineHeight: 'var(--v2-leading-relaxed)' }}>
              {b}
            </li>
          ))}
        </ul>
      </div>

      {/* Section 4: how the algorithm uses this phase. NC's "show your
          work" pattern. The label intentionally repeats the phase name
          so this section reads as scoped to the phase the user is in. */}
      <div>
        <h3
          style={{
            margin: '0 0 var(--v2-space-1)',
            fontSize: 'var(--v2-text-md)',
            fontWeight: 'var(--v2-weight-semibold)',
            color: 'inherit',
          }}
        >
          {PHASE_LABEL[phase]} phase &amp; the algorithm
        </h3>
        <p style={{ margin: 0 }}>{sections.algorithm}</p>
      </div>
    </ExplainerSheet>
  )
}
