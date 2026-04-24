'use client'

/**
 * PhaseExplainer
 *
 * Tap-to-explain modal for the cycle phase label inside the hero ring
 * (Menstrual / Follicular / Ovulatory / Luteal). Describes each phase
 * briefly so the reader can connect today's symptoms to a phase
 * without needing a textbook.
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

export default function PhaseExplainer({ open, onClose, phase, day }: PhaseExplainerProps) {
  const title = phase ? `${PHASE_LABEL[phase]} phase` : 'Cycle phase'
  const hasDay = typeof day === 'number' && Number.isFinite(day)

  const sourceNote = phase
    ? hasDay
      ? `Estimated from your logged period start and your typical cycle length. Today is day ${day}, which usually falls in the ${PHASE_LABEL[phase].toLowerCase()} window.`
      : `Estimated from your logged period start and your typical cycle length.`
    : 'No phase yet. Log a period start to begin estimating phase windows.'

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
