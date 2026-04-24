'use client'

/**
 * CoverLineExplainer
 *
 * Tap-to-explain modal for the BbtChart's cover-line transition. The
 * line color shift (green to red) IS the cover line, made visible.
 * Per NC reference frames, no horizontal threshold is ever drawn:
 * doing so would imply a clinical universal cutoff, when in reality
 * each cycler has their own personal moving baseline.
 *
 * Voice anchor: gentle, clinical clarity, no false precision. Same
 * pattern as the other section MetricExplainers in this folder.
 */
import ExplainerSheet from '../../../_components/ExplainerSheet'

export interface CoverLineExplainerProps {
  open: boolean
  onClose: () => void
  /** The user's current cover line in degrees F, or null when not yet computed. */
  coverLine: number | null
  /** True when a sustained post-ovulatory shift is detected. */
  shiftDetected: boolean
}

export default function CoverLineExplainer({
  open,
  onClose,
  coverLine,
  shiftDetected,
}: CoverLineExplainerProps) {
  const hasCover = typeof coverLine === 'number' && Number.isFinite(coverLine)
  const sourceNote = hasCover
    ? shiftDetected
      ? `Your current cover line sits at about ${coverLine.toFixed(2)}°F. Readings above it have been sustained, which usually means ovulation has already happened this cycle.`
      : `Your current cover line sits at about ${coverLine.toFixed(2)}°F. Readings have not yet shifted above it for three consecutive days.`
    : 'Not enough morning temperatures yet to draw a personal cover line. A few more readings and the curve will start to color itself.'

  return (
    <ExplainerSheet open={open} onClose={onClose} title="Why the line changes color" source={sourceNote}>
      <p style={{ margin: 0 }}>
        Your basal body temperature usually sits in a narrow range during the
        follicular phase. After ovulation, progesterone nudges it up by a few
        tenths of a degree, and it stays there for the rest of the cycle.
      </p>
      <p style={{ margin: 0 }}>
        The <strong>green segments</strong> are mornings where your temperature
        sat at or below your personal baseline. The <strong>red segments</strong>{' '}
        are mornings where it sat above. The transition is what confirms
        ovulation has happened, not any single reading.
      </p>
      <p style={{ margin: 0 }}>
        <strong>This is your baseline, not a clinical cutoff.</strong> Different
        bodies sit at different temperatures. We compute your cover line from
        your own follicular-phase readings, so it shifts as the app learns you.
        Natural Cycles uses the same personal-moving-baseline approach in their
        FDA-cleared algorithm.
      </p>
      <p style={{ margin: 0 }}>
        We deliberately do not draw a horizontal cover line on the chart. A line
        across the page would imply a sharp threshold, when the real signal is
        the sustained pattern. Letting the curve color itself keeps the focus on
        the shift you can see.
      </p>
    </ExplainerSheet>
  )
}
