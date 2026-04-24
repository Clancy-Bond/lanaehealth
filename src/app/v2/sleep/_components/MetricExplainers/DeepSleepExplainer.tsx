'use client'

/**
 * DeepSleepExplainer
 *
 * Tap-to-explain modal for deep (slow-wave) sleep. Same percentage-of-
 * total approach as REM so the band makes sense regardless of how
 * long the night was.
 */
import ExplainerSheet, { type ExplainerBand } from '../../../_components/ExplainerSheet'

export interface DeepSleepExplainerProps {
  open: boolean
  onClose: () => void
  deepMinutes: number | null | undefined
  totalSleepSeconds: number | null | undefined
  dateISO: string | null | undefined
}

const BANDS: ExplainerBand[] = [
  { label: 'Low', min: 0, max: 10, color: 'var(--v2-accent-warning)' },
  { label: 'Fair', min: 10, max: 15, color: 'var(--v2-accent-highlight)' },
  { label: 'Optimal', min: 15, max: 25, color: 'var(--v2-accent-success)' },
  { label: 'High', min: 25, max: 40, color: 'var(--v2-accent-primary)' },
]

function labelForPct(pct: number): string {
  if (pct < 10) return 'Low'
  if (pct < 15) return 'Fair'
  if (pct < 25) return 'Optimal'
  return 'High'
}

export default function DeepSleepExplainer({
  open,
  onClose,
  deepMinutes,
  totalSleepSeconds,
  dateISO,
}: DeepSleepExplainerProps) {
  const hasDeep = typeof deepMinutes === 'number' && Number.isFinite(deepMinutes)
  const hasTotal = typeof totalSleepSeconds === 'number' && Number.isFinite(totalSleepSeconds) && totalSleepSeconds > 0
  const totalMin = hasTotal ? (totalSleepSeconds as number) / 60 : null
  const pct = hasDeep && totalMin ? ((deepMinutes as number) / totalMin) * 100 : null
  const pctRounded = pct != null ? Math.round(pct) : null

  const sourceNote = hasDeep
    ? totalMin != null && pct != null
      ? `Last night${dateISO ? ` (${dateISO})` : ''} you spent ${Math.round(deepMinutes as number)} minutes in deep sleep, about ${pctRounded}% of total sleep.`
      : `Last night${dateISO ? ` (${dateISO})` : ''} you spent ${Math.round(deepMinutes as number)} minutes in deep sleep.`
    : 'No deep sleep data synced yet. Wear the ring overnight and a reading will appear here in the morning.'

  return (
    <ExplainerSheet
      open={open}
      onClose={onClose}
      title="Deep sleep"
      bands={BANDS}
      currentValue={pctRounded}
      currentBandLabel={pctRounded != null ? labelForPct(pctRounded) : undefined}
      source={sourceNote}
    >
      <p style={{ margin: 0 }}>
        Deep sleep is the slow-wave stage where your body does most of its physical
        maintenance, tissue repair, and immune work. It tends to come in the first
        half of the night.
      </p>
      <p style={{ margin: 0 }}>
        Most adults see 15 to 25 percent of total sleep as deep. Older adults often
        see less, which is normal aging rather than a problem to fix. The number
        matters less than how rested you actually feel.
      </p>
      <p style={{ margin: 0 }}>
        <strong>How we compute it:</strong> we show deep-sleep minutes exactly as your
        ring reports them, then convert to a percentage of total sleep for the band.
      </p>
    </ExplainerSheet>
  )
}
