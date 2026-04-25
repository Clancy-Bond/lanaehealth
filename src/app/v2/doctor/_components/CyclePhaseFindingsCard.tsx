import { Card } from '@/v2/components/primitives'
import DoctorPanelHeader from './DoctorPanelHeader'
import type { CyclePhaseFinding } from '@/lib/doctor/cycle-phase-correlation'

interface CyclePhaseFindingsCardProps {
  findings: CyclePhaseFinding[]
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/*
 * CyclePhaseFindingsCard
 *
 * Symptoms that concentrate in one cycle phase (≥30% elevation over
 * the other three phases). This is the OB/GYN gold: "your pain
 * spikes in luteal phase, not menstrual — that shifts the
 * differential toward PMDD, not dysmenorrhea."
 *
 * Noteworthy findings are surfaced in full; the rest are collapsed
 * to a count to avoid cluttering the OB/GYN view.
 *
 * Empty state: surfaces to OB/GYN view only (bucket-gated at the
 * orchestrator). When the correlation pipeline returns nothing,
 * the doctor still needs to know we looked.
 */
export default function CyclePhaseFindingsCard({ findings }: CyclePhaseFindingsCardProps) {
  if (findings.length === 0) {
    return (
      <Card padding="md">
        <DoctorPanelHeader
          title="Cycle-phase patterns"
          summary="No phase-linked patterns detected yet. Needs more data or correlations may not be strong."
        />
      </Card>
    )
  }
  const noteworthy = findings.filter((f) => f.noteworthy)
  const summary =
    noteworthy.length > 0
      ? `${noteworthy.length} phase-linked pattern${noteworthy.length === 1 ? '' : 's'} detected`
      : `${findings.length} metric${findings.length === 1 ? '' : 's'} tracked, no strong phase pattern`

  return (
    <Card padding="md">
      <DoctorPanelHeader title="Cycle-phase patterns" summary={summary} />
      {noteworthy.length > 0 ? (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-2)',
          }}
        >
          {noteworthy.map((f) => (
            <li
              key={f.metric}
              style={{
                padding: 'var(--v2-space-2) 0',
                borderBottom: '1px solid var(--v2-border-subtle)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span
                  style={{
                    fontSize: 'var(--v2-text-sm)',
                    fontWeight: 'var(--v2-weight-semibold)',
                    color: 'var(--v2-text-primary)',
                  }}
                >
                  {f.metric}
                </span>
                <span
                  style={{
                    fontSize: 'var(--v2-text-xs)',
                    color: 'var(--v2-accent-warning)',
                    fontWeight: 'var(--v2-weight-semibold)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {titleCase(f.dominantPhase)} +{Math.round(f.relativeIncrease)}%
                </span>
              </div>
              <div
                style={{
                  fontSize: 'var(--v2-text-xs)',
                  color: 'var(--v2-text-muted)',
                  marginTop: 2,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {(['menstrual', 'follicular', 'ovulatory', 'luteal'] as const).map((p) => {
                  const v = f.phaseAverages[p]
                  const mean = v.mean !== null ? v.mean.toFixed(1) : '—'
                  return `${titleCase(p)} ${mean} (n=${v.n})`
                }).join(' · ')}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)' }}>
          No single phase dominates current symptom data.
        </p>
      )}
    </Card>
  )
}
