'use client'

/**
 * HRVExplainer
 *
 * Tap-to-explain modal for the HRV chip on home. HRV is interpreted
 * against your own baseline, not an absolute band, so the modal leans
 * on the NC-voiced paragraph and skips hard 0-100 thresholds.
 */
import ExplainerSheet from '../ExplainerSheet'

export interface HRVExplainerProps {
  open: boolean
  onClose: () => void
  value: number | null | undefined
  medianRecent: number | null | undefined
  dateISO: string | null
}

export default function HRVExplainer({ open, onClose, value, medianRecent, dateISO }: HRVExplainerProps) {
  const hasValue = typeof value === 'number' && Number.isFinite(value)
  const hasMedian = typeof medianRecent === 'number' && Number.isFinite(medianRecent)
  const delta = hasValue && hasMedian ? (value as number) - (medianRecent as number) : null

  const sourceNote = hasValue
    ? hasMedian
      ? `Last night's average was ${Math.round(value as number)} ms${
          delta != null
            ? `, ${delta >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(delta))} ms versus your recent median.`
            : '.'
        }${dateISO ? ` (${dateISO})` : ''}`
      : `Last night's average was ${Math.round(value as number)} ms.${dateISO ? ` (${dateISO})` : ''}`
    : 'No HRV recording synced yet. Wear the ring overnight and a reading will appear here tomorrow.'

  return (
    <ExplainerSheet
      open={open}
      onClose={onClose}
      title="Heart rate variability"
      source={sourceNote}
    >
      <p style={{ margin: 0 }}>
        HRV measures tiny gaps in time between heartbeats while you sleep. Higher
        generally means your nervous system looks well recovered. Lower often shows
        up after hard exertion, a poor night&apos;s sleep, illness, or a flare.
      </p>
      <p style={{ margin: 0 }}>
        Your own baseline is what matters, not a universal target. Comparing your
        reading to other people will mostly just confuse the signal.
      </p>
      <p style={{ margin: 0 }}>
        <strong>How we compute it:</strong> we display the nightly average your ring
        reports. When there&apos;s enough history, we also show how today compares to your
        recent median so a one-off dip reads differently than a week-long drift.
      </p>
    </ExplainerSheet>
  )
}
