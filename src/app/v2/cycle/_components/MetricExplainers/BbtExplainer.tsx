'use client'

/**
 * BbtExplainer
 *
 * Tap-to-explain modal for the basal body temperature tile. BBT is
 * absolute degrees Fahrenheit, but the meaningful signal is the
 * sustained rise after ovulation, not any single reading.
 */
import ExplainerSheet from '../../../_components/ExplainerSheet'

export interface BbtExplainerProps {
  open: boolean
  onClose: () => void
  tempF: number | null | undefined
  confirmedOvulation: boolean
  measuredAtISO: string | null | undefined
}

export default function BbtExplainer({
  open,
  onClose,
  tempF,
  confirmedOvulation,
  measuredAtISO,
}: BbtExplainerProps) {
  const hasTemp = typeof tempF === 'number' && Number.isFinite(tempF)
  const sourceNote = hasTemp
    ? confirmedOvulation
      ? `Last reading was ${tempF.toFixed(2)}°F${measuredAtISO ? ` (${measuredAtISO})` : ''}. We see a sustained rise above your follicular baseline, which usually indicates ovulation has happened.`
      : `Last reading was ${tempF.toFixed(2)}°F${measuredAtISO ? ` (${measuredAtISO})` : ''}. Not enough sustained rise yet to confirm ovulation.`
    : 'No basal temperature logged yet. Tap the Log temp button to add a morning reading.'

  return (
    <ExplainerSheet open={open} onClose={onClose} title="Basal body temperature" source={sourceNote}>
      <p style={{ margin: 0 }}>
        Basal body temperature is your resting temperature first thing in the morning,
        before getting out of bed or drinking anything. It is usually a few tenths of
        a degree higher in the second half of the cycle.
      </p>
      <p style={{ margin: 0 }}>
        The single number is not the point. What matters is the pattern: a sustained
        rise of roughly 0.4°F or more across three or more days, after a stretch of
        lower readings, is the classic signal that ovulation has happened.
      </p>
      <p style={{ margin: 0 }}>
        <strong>How we compute it:</strong> we display each reading exactly as you log
        it. The &ldquo;sustained rise detected&rdquo; badge appears once we see the pattern above,
        compared against your own follicular-phase baseline.
      </p>
    </ExplainerSheet>
  )
}
