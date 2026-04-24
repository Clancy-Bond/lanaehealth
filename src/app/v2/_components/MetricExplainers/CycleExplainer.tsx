'use client'

/**
 * CycleExplainer
 *
 * Tap-to-explain modal for the Cycle day / phase chip on home.
 * Cycle is ordinal (day number), not a 0-100 score, so we skip the
 * band bar and instead describe the four phases in NC voice.
 */
import ExplainerSheet from '../ExplainerSheet'

export interface CycleExplainerProps {
  open: boolean
  onClose: () => void
  day: number | null | undefined
  phase: string | null | undefined
  isUnusuallyLong: boolean | null | undefined
  lastPeriodISO: string | null | undefined
}

function formatPhase(phase: string | null | undefined): string {
  if (!phase) return 'unknown'
  return phase[0].toUpperCase() + phase.slice(1)
}

export default function CycleExplainer({
  open,
  onClose,
  day,
  phase,
  isUnusuallyLong,
  lastPeriodISO,
}: CycleExplainerProps) {
  const hasPhase = typeof phase === 'string' && phase.length > 0
  const hasDay = typeof day === 'number' && Number.isFinite(day)

  const sourceNote = hasDay
    ? lastPeriodISO
      ? `Counting forward from your last logged period (${lastPeriodISO}).${
          isUnusuallyLong ? ' This cycle is running longer than your recent average.' : ''
        }`
      : 'Counting forward from your last logged period.'
    : 'No cycle data yet. Log a period from the cycle tab and the counter will start.'

  return (
    <ExplainerSheet
      open={open}
      onClose={onClose}
      title={hasPhase ? `Cycle day ${day ?? ''}, ${formatPhase(phase)}` : 'Cycle'}
      source={sourceNote}
    >
      <p style={{ margin: 0 }}>
        Your cycle number is simply the count of days since your last period started.
        We pair it with the phase your body is most likely in today so the rest of the
        app can interpret symptoms in context.
      </p>
      <p style={{ margin: 0 }}>
        <strong>Menstrual</strong> covers the bleed itself. <strong>Follicular</strong>
        {' '}runs from the end of your period to ovulation. <strong>Ovulatory</strong>
        {' '}is the few days around the release of an egg. <strong>Luteal</strong> is
        the back half of the cycle until the next period. Symptoms often cluster by
        phase, which is why the doctor summary groups them that way.
      </p>
      <p style={{ margin: 0 }}>
        <strong>How we compute it:</strong> we only use your own logged periods, never
        an algorithmic prediction. If a period is logged late, the day count updates
        retroactively so the record stays accurate.
      </p>
    </ExplainerSheet>
  )
}
