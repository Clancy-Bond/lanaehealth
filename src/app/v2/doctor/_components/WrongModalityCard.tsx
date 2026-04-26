import { Card } from '@/v2/components/primitives'
import DoctorPanelHeader from './DoctorPanelHeader'
import type { WrongModalityFlag } from '@/lib/doctor/wrong-modality'

interface WrongModalityCardProps {
  flags: WrongModalityFlag[]
}

/*
 * WrongModalityCard
 *
 * Imaging that isn't the right test for the condition being worked up.
 * Example: a head CT to rule out a CSF leak where MRI sagittal T1/T2
 * is the preferred modality. Catching this avoids "we already imaged
 * that" moments that close out real hypotheses prematurely.
 *
 * Safety-critical empty state: silence would be ambiguous - the
 * doctor needs to know we looked. Explicit "no modality concerns"
 * confirms the imaging done so far matches the hypotheses.
 */
export default function WrongModalityCard({ flags }: WrongModalityCardProps) {
  if (flags.length === 0) {
    return (
      <Card padding="md">
        <DoctorPanelHeader
          title="Imaging modality review"
          summary="Imaging done so far matches the active hypotheses - no modality concerns."
        />
      </Card>
    )
  }
  const summary = `${flags.length} imaging study${flags.length === 1 ? '' : 'ies'} may be the wrong test`

  return (
    <Card padding="md">
      <DoctorPanelHeader title="Imaging modality review" summary={summary} />
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-3)',
        }}
      >
        {flags.map((f) => (
          <li
            key={f.imagingStudyId}
            style={{
              padding: 'var(--v2-space-3)',
              borderRadius: 'var(--v2-radius-sm)',
              background: 'rgba(217, 119, 92, 0.08)',
              border: '1px solid rgba(217, 119, 92, 0.35)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--v2-space-2)' }}>
              <span
                style={{
                  fontSize: 'var(--v2-text-sm)',
                  fontWeight: 'var(--v2-weight-semibold)',
                  color: 'var(--v2-text-primary)',
                }}
              >
                {f.hypothesis}
              </span>
              <span
                style={{
                  fontSize: 'var(--v2-text-xs)',
                  color: 'var(--v2-text-muted)',
                  whiteSpace: 'nowrap',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {f.studyDate}
              </span>
            </div>
            <div
              style={{
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-secondary)',
                marginTop: 2,
              }}
            >
              Did <strong>{f.modalityUsed}</strong> {f.bodyPart.toLowerCase()} · preferred <strong>{f.preferredModality}</strong>
            </div>
            <div
              style={{
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-accent-warning)',
                marginTop: 'var(--v2-space-1)',
                lineHeight: 'var(--v2-leading-normal)',
              }}
            >
              {f.rationale}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
