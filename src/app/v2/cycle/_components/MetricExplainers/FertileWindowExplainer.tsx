'use client'

/**
 * FertileWindowExplainer
 *
 * Tap-to-explain modal for the Fertility Awareness card. Has to be
 * extra careful to repeat the "awareness, not contraception" framing,
 * since the wrong inference here has consequences.
 */
import ExplainerSheet from '../../../_components/ExplainerSheet'

export interface FertileWindowExplainerProps {
  open: boolean
  onClose: () => void
  status: 'green' | 'yellow' | 'red' | 'unknown'
  rangeStart: string | null | undefined
  rangeEnd: string | null | undefined
  confirmedOvulation: boolean
}

function statusCopy(status: 'green' | 'yellow' | 'red' | 'unknown'): string {
  if (status === 'green') return 'Likely lower-fertility window today.'
  if (status === 'yellow') return 'Approaching or leaving the fertile window.'
  if (status === 'red') return 'Within the estimated fertile window today.'
  return 'Not enough data to estimate today.'
}

export default function FertileWindowExplainer({
  open,
  onClose,
  status,
  rangeStart,
  rangeEnd,
  confirmedOvulation,
}: FertileWindowExplainerProps) {
  const parts: string[] = [statusCopy(status)]
  if (rangeStart && rangeEnd) {
    parts.push(`Estimated window: ${rangeStart} to ${rangeEnd}.`)
  }
  if (confirmedOvulation) {
    parts.push('A sustained basal-temperature rise has been detected this cycle.')
  }

  return (
    <ExplainerSheet open={open} onClose={onClose} title="Fertile window" source={parts.join(' ')}>
      <p style={{ margin: 0 }}>
        The fertile window is the stretch of days when conception is most likely,
        usually the five days before ovulation plus the day of ovulation itself.
        Sperm can survive for several days, so the window opens before the egg is
        actually released.
      </p>
      <p style={{ margin: 0 }}>
        We show this so you can recognise patterns in symptoms, mood, and energy that
        cluster around ovulation. It is not a contraceptive method and was never
        designed as one.
      </p>
      <p style={{ margin: 0 }}>
        <strong>How we compute it:</strong> we estimate the window from your cycle day
        and your recent average length. When you log basal temperatures, we can also
        confirm ovulation after the fact by detecting the sustained rise. Both are
        estimates, not lab-grade timing.
      </p>
      <p style={{ margin: 0, fontStyle: 'italic' }}>
        Awareness, not contraception. Use a method designed for that purpose if
        avoiding pregnancy matters.
      </p>
    </ExplainerSheet>
  )
}
