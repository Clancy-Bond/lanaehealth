'use client'

/**
 * CycleDayExplainer
 *
 * Tap-to-explain modal for the day number at the center of the cycle
 * hero ring. Cycle day is ordinal, not a 0-100 score, so we skip the
 * band bar and lean on plain-language voice.
 */
import ExplainerSheet from '../../../_components/ExplainerSheet'

export interface CycleDayExplainerProps {
  open: boolean
  onClose: () => void
  day: number | null | undefined
  meanCycleLength: number | null | undefined
  isUnusuallyLong: boolean | null | undefined
  lastPeriodISO: string | null | undefined
}

export default function CycleDayExplainer({
  open,
  onClose,
  day,
  meanCycleLength,
  isUnusuallyLong,
  lastPeriodISO,
}: CycleDayExplainerProps) {
  const hasDay = typeof day === 'number' && Number.isFinite(day)
  const denom = meanCycleLength && meanCycleLength > 0 ? Math.round(meanCycleLength) : 28

  const sourceNote = hasDay
    ? lastPeriodISO
      ? `Counting forward from your last logged period start (${lastPeriodISO}). Your recent average cycle is about ${denom} days.${
          isUnusuallyLong ? ' This cycle is running longer than that average.' : ''
        }`
      : `Counting forward from your last logged period start. Your recent average cycle is about ${denom} days.`
    : 'No cycle data yet. Log a period start and the day count will begin.'

  return (
    <ExplainerSheet
      open={open}
      onClose={onClose}
      title={hasDay ? `Cycle day ${day}` : 'Cycle day'}
      source={sourceNote}
    >
      <p style={{ margin: 0 }}>
        Cycle day is simply the number of days since your last period began. Day 1 is
        the first day of bleeding. The count keeps going until your next period
        starts, then resets to 1.
      </p>
      <p style={{ margin: 0 }}>
        Knowing where you are in the cycle helps the rest of the app interpret
        symptoms in context. The same headache on day 3 versus day 24 can mean
        different things.
      </p>
      <p style={{ margin: 0 }}>
        <strong>How we compute it:</strong> we count from your most recent logged
        period start, never from a prediction. If you log a period late, the day count
        updates retroactively so the record stays honest.
      </p>
    </ExplainerSheet>
  )
}
