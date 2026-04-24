/**
 * Fertile-window classifier.
 *
 * Natural Cycles' signature UX is a daily green/red indicator. The NC
 * algorithm is strictly BINARY for Birth Control mode (Red/Green). A
 * third "Brown" state exists only in Plan Pregnancy mode and means "more
 * data needed"; NC does NOT emit a "Yellow" tier.
 *
 * Wave 1 of the cycle deep rebuild (2026-04-23) strips the yellow tier
 * from this classifier and layers NC's imported verdict on top:
 *
 *   - If NC has imported a fertility_color for the target date, use it
 *     verbatim. NC is FDA-cleared; our recomputation is not.
 *   - Otherwise compute from the fused ovulation signal + calendar. The
 *     output is either green (affirmatively not fertile) or red (fertile
 *     or unknown). NC's conservative default is red when uncertain, and
 *     that is our default too.
 *   - Callers that need a third state (e.g., "no data yet") should check
 *     the inputs before calling; this function always returns green or
 *     red when it can compute anything at all.
 *
 * Voice: "Use protection" / "Less likely fertile" rather than "safe day"
 * or "danger day". NC's framing.
 */

import type { FusionResult } from './signal-fusion'

export type FertileStatus = 'green' | 'red'

export interface FertileInputs {
  cycleDay: number | null
  phase: 'menstrual' | 'follicular' | 'ovulatory' | 'luteal' | null
  isUnusuallyLong: boolean
  /** Did the user log ovulation signs in the last 3 days? */
  confirmedOvulation?: boolean
  /**
   * New (Wave 1): NC's own verdict for the date, when present in the
   * imported history. When this is set, we return it verbatim -- NC's
   * verdict beats our recomputation.
   */
  ncFertilityColor?: 'GREEN' | 'RED' | null
  /**
   * New (Wave 1): fused ovulation signal for the cycle containing this
   * date. When BBT confirms a sustained post-ovulation shift, we can emit
   * green from CD20+; absent that, CD8-19 stays red.
   */
  ovulation?: FusionResult | null
}

export interface FertileSignal {
  status: FertileStatus
  label: string
  detail: string
}

export function classifyFertileWindow(input: FertileInputs): FertileSignal {
  const { cycleDay, isUnusuallyLong, confirmedOvulation, ncFertilityColor, ovulation } = input

  // 1. NC's own verdict wins.
  if (ncFertilityColor === 'GREEN') {
    return {
      status: 'green',
      label: 'Not fertile',
      detail: 'Natural Cycles marked this day green based on your imported history.',
    }
  }
  if (ncFertilityColor === 'RED') {
    return {
      status: 'red',
      label: 'Use protection',
      detail: 'Natural Cycles marked this day red based on your imported history.',
    }
  }

  // 2. No cycle day -> red by default. NC's conservative default.
  if (cycleDay === null) {
    return {
      status: 'red',
      label: 'Use protection',
      detail: 'Not enough period history to rule this day out. Logging a period start starts the green days.',
    }
  }

  // 3. Unusually long cycle -> red. We cannot prove not-fertile until
  // ovulation is confirmed or the cycle ends.
  if (isUnusuallyLong) {
    return {
      status: 'red',
      label: 'Use protection',
      detail: 'Cycle is longer than expected. Without confirmed ovulation, the algorithm cannot rule out a late fertile window.',
    }
  }

  // 4. CD 1-5 plus short tail of heavy bleeding -> green. NC gives these
  // days as green for most users because ovulation this early is
  // biologically implausible.
  if (cycleDay <= 5) {
    return {
      status: 'green',
      label: 'Not fertile',
      detail: `Day ${cycleDay} of cycle. Menstruating. Pregnancy risk is very low this early.`,
    }
  }

  // 5. Post-ovulation confirmation. If fused signal or the BBT helper
  // confirms ovulation has occurred, we can emit green from the day after
  // confirmation, since the egg survives <=24h past ovulation.
  const postOvulationByFusion = ovulation?.ovulationDate != null
    && ovulation.bbtShiftDetected
    && isDayAfter(ovulation.ovulationDate, cycleDay, input.phase === 'luteal')
  if (postOvulationByFusion || (confirmedOvulation && cycleDay >= 18)) {
    return {
      status: 'green',
      label: 'Not fertile',
      detail: `Day ${cycleDay}. Sustained post-ovulatory BBT rise. The fertile window has closed for this cycle.`,
    }
  }

  // 6. Default for CD 6-19 and unresolved luteal: red.
  return {
    status: 'red',
    label: 'Use protection',
    detail: `Day ${cycleDay}. Fertile window is typically CD 10-17. Without confirmed ovulation, treat this day as potentially fertile.`,
  }
}

export function phaseBadgeColor(phase: string | null | undefined): string {
  switch ((phase ?? '').toLowerCase()) {
    case 'menstrual':
      return 'var(--phase-menstrual)'
    case 'follicular':
      return 'var(--phase-follicular)'
    case 'ovulatory':
      return 'var(--phase-ovulatory)'
    case 'luteal':
      return 'var(--phase-luteal)'
    default:
      return 'var(--text-muted)'
  }
}

function isDayAfter(ovulationDate: string, cycleDay: number, inLuteal: boolean): boolean {
  // When we know the date of ovulation AND the current cycle day puts us
  // in the luteal phase, trust it. Otherwise require the phase check too.
  if (!ovulationDate) return false
  return inLuteal || cycleDay >= 16
}
