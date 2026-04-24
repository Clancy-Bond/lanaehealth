'use client'

/**
 * SleepLatencyExplainer
 *
 * Tap-to-explain modal for sleep latency, the time it takes to fall
 * asleep after going to bed. We band in minutes; lower is generally
 * better, with very low (<5 minutes) sometimes signalling sleep debt.
 */
import ExplainerSheet, { type ExplainerBand } from '../../../_components/ExplainerSheet'

export interface SleepLatencyExplainerProps {
  open: boolean
  onClose: () => void
  latencyMinutes: number | null | undefined
  dateISO: string | null | undefined
}

const BANDS: ExplainerBand[] = [
  { label: 'Very fast', min: 0, max: 10, color: 'var(--v2-accent-success)' },
  { label: 'Typical', min: 10, max: 20, color: 'var(--v2-accent-primary)' },
  { label: 'Slower', min: 20, max: 30, color: 'var(--v2-accent-highlight)' },
  { label: 'Long', min: 30, max: 60, color: 'var(--v2-accent-warning)' },
]

function labelFor(min: number): string {
  if (min < 10) return 'Very fast'
  if (min < 20) return 'Typical'
  if (min < 30) return 'Slower'
  return 'Long'
}

export default function SleepLatencyExplainer({
  open,
  onClose,
  latencyMinutes,
  dateISO,
}: SleepLatencyExplainerProps) {
  const hasValue = typeof latencyMinutes === 'number' && Number.isFinite(latencyMinutes)

  const sourceNote = hasValue
    ? `Last night${dateISO ? ` (${dateISO})` : ''} it took about ${Math.round(latencyMinutes as number)} minute${Math.round(latencyMinutes as number) === 1 ? '' : 's'} to fall asleep.`
    : 'No latency data synced yet. Once a night syncs, the time to fall asleep will appear here.'

  return (
    <ExplainerSheet
      open={open}
      onClose={onClose}
      title="Sleep latency"
      bands={BANDS}
      currentValue={hasValue ? Math.round(latencyMinutes as number) : null}
      currentBandLabel={hasValue ? labelFor(Math.round(latencyMinutes as number)) : undefined}
      source={sourceNote}
    >
      <p style={{ margin: 0 }}>
        Sleep latency is how long it takes to fall asleep after lying down with the
        intent to sleep. Most healthy adults land somewhere between 10 and 20 minutes.
      </p>
      <p style={{ margin: 0 }}>
        Long latency, repeatedly above 30 minutes, often points at racing thoughts,
        late caffeine, screens too close to bed, or a sleep schedule that drifted.
        Falling asleep almost instantly, under 5 minutes, can quietly mean the
        opposite: you are sleep-deprived.
      </p>
      <p style={{ margin: 0 }}>
        <strong>How we compute it:</strong> we show the value your ring reports for
        time-to-sleep on a single night. Bedtime habits move this number more
        reliably than any quick fix.
      </p>
    </ExplainerSheet>
  )
}
