import { Card } from '@/v2/components/primitives'
import DoctorPanelHeader from './DoctorPanelHeader'
import type { MedicationDelta } from '@/lib/doctor/medication-deltas'

interface MedicationDeltasCardProps {
  deltas: MedicationDelta[]
}

function formatDelta(d: number | null, direction: MedicationDelta['metrics'][number]['direction']): string {
  if (d === null || direction === 'insufficient') return 'insufficient data'
  const sign = d > 0 ? '+' : ''
  return `${sign}${d.toFixed(1)} (${direction})`
}

function directionColor(direction: MedicationDelta['metrics'][number]['direction']): string {
  if (direction === 'improved') return 'var(--v2-accent-success)'
  if (direction === 'worsened') return 'var(--v2-accent-danger)'
  return 'var(--v2-text-muted)'
}

/*
 * MedicationDeltasCard
 *
 * For each medication start/change, the 14-day-before vs 14-day-after
 * delta across pain/fatigue/bloat/stress/sleep + HRV + RHR. If a med
 * change preceded a symptom shift, the doctor should hear about it.
 * Noteworthy deltas are bolded; insufficient-data metrics are
 * suppressed so noise doesn't drown the signal.
 *
 * Empty state: "no recent medication changes" is a useful baseline
 * signal for the doctor, especially when patient is on a stable
 * regimen.
 */
export default function MedicationDeltasCard({ deltas }: MedicationDeltasCardProps) {
  if (deltas.length === 0) {
    return (
      <Card padding="md">
        <DoctorPanelHeader
          title="Medication deltas"
          summary="No recent medication changes to compare. Regimen has been stable."
        />
      </Card>
    )
  }
  const noteworthyCount = deltas.reduce(
    (n, d) => n + d.metrics.filter((m) => m.noteworthy).length,
    0,
  )
  const summary =
    noteworthyCount > 0
      ? `${noteworthyCount} noteworthy shift${noteworthyCount === 1 ? '' : 's'} after medication change${deltas.length === 1 ? '' : 's'}`
      : `${deltas.length} medication event${deltas.length === 1 ? '' : 's'}; no notable deltas`

  return (
    <Card padding="md">
      <DoctorPanelHeader title="Medication deltas" summary={summary} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
        {deltas.map((d) => {
          const relevant = d.metrics.filter((m) => m.direction !== 'insufficient')
          if (relevant.length === 0) return null
          return (
            <div key={d.eventDate + d.title}>
              <div
                style={{
                  fontSize: 'var(--v2-text-sm)',
                  fontWeight: 'var(--v2-weight-semibold)',
                  color: 'var(--v2-text-primary)',
                }}
              >
                {d.title}
              </div>
              <div style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)', marginBottom: 'var(--v2-space-2)' }}>
                {d.eventDate} · window {d.windowBeforeStart} to {d.windowAfterEnd}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' }}>
                {relevant.map((m) => (
                  <li
                    key={m.metric}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 'var(--v2-text-sm)',
                      padding: 'var(--v2-space-1) 0',
                      color: 'var(--v2-text-secondary)',
                    }}
                  >
                    <span style={{ fontWeight: m.noteworthy ? 'var(--v2-weight-semibold)' : 'var(--v2-weight-regular)' }}>
                      {m.metric}
                    </span>
                    <span
                      style={{
                        fontVariantNumeric: 'tabular-nums',
                        color: directionColor(m.direction),
                        fontWeight: m.noteworthy ? 'var(--v2-weight-semibold)' : 'var(--v2-weight-regular)',
                      }}
                    >
                      {formatDelta(m.delta, m.direction)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
