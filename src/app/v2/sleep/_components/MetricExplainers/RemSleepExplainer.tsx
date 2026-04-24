'use client'

/**
 * RemSleepExplainer
 *
 * Tap-to-explain modal for REM sleep. The clean 0-100 band model
 * doesn't fit minutes, so we band on REM as a percentage of total
 * sleep, which is what Oura compares against population norms.
 */
import ExplainerSheet, { type ExplainerBand } from '../../../_components/ExplainerSheet'

export interface RemSleepExplainerProps {
  open: boolean
  onClose: () => void
  remMinutes: number | null | undefined
  totalSleepSeconds: number | null | undefined
  dateISO: string | null | undefined
}

const BANDS: ExplainerBand[] = [
  { label: 'Low', min: 0, max: 15, color: 'var(--v2-accent-warning)' },
  { label: 'Fair', min: 15, max: 20, color: 'var(--v2-accent-highlight)' },
  { label: 'Optimal', min: 20, max: 25, color: 'var(--v2-accent-success)' },
  { label: 'High', min: 25, max: 35, color: 'var(--v2-accent-primary)' },
]

function labelForPct(pct: number): string {
  if (pct < 15) return 'Low'
  if (pct < 20) return 'Fair'
  if (pct < 25) return 'Optimal'
  return 'High'
}

export default function RemSleepExplainer({
  open,
  onClose,
  remMinutes,
  totalSleepSeconds,
  dateISO,
}: RemSleepExplainerProps) {
  const hasRem = typeof remMinutes === 'number' && Number.isFinite(remMinutes)
  const hasTotal = typeof totalSleepSeconds === 'number' && Number.isFinite(totalSleepSeconds) && totalSleepSeconds > 0
  const totalMin = hasTotal ? (totalSleepSeconds as number) / 60 : null
  const pct = hasRem && totalMin ? ((remMinutes as number) / totalMin) * 100 : null
  const pctRounded = pct != null ? Math.round(pct) : null

  const sourceNote = hasRem
    ? totalMin != null && pct != null
      ? `Last night${dateISO ? ` (${dateISO})` : ''} you spent ${Math.round(remMinutes as number)} minutes in REM, about ${pctRounded}% of total sleep.`
      : `Last night${dateISO ? ` (${dateISO})` : ''} you spent ${Math.round(remMinutes as number)} minutes in REM.`
    : 'No REM data synced yet. Wear the ring overnight and a reading will appear here in the morning.'

  return (
    <ExplainerSheet
      open={open}
      onClose={onClose}
      title="REM sleep"
      bands={BANDS}
      currentValue={pctRounded}
      currentBandLabel={pctRounded != null ? labelForPct(pctRounded) : undefined}
      source={sourceNote}
    >
      <p style={{ margin: 0 }}>
        REM stands for rapid eye movement, the stage where most dreaming happens. It
        has been associated with consolidating memories and processing emotion.
      </p>
      <p style={{ margin: 0 }}>
        Most adults spend 20 to 25 percent of total sleep in REM. The bands above are
        in percentage terms because the absolute minutes depend on how long you slept
        overall.
      </p>
      <p style={{ margin: 0 }}>
        Big swings between nights are normal. Trends over a week or two tell a cleaner
        story than any one night. Alcohol and very late nights tend to compress REM.
      </p>
      <p style={{ margin: 0 }}>
        <strong>How we compute it:</strong> we display REM minutes exactly as your
        ring reports, then convert to a percentage of total sleep for the band.
      </p>
    </ExplainerSheet>
  )
}
