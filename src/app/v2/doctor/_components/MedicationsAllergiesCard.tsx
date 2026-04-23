import { Card, ListRow } from '@/v2/components/primitives'
import DoctorPanelHeader from './DoctorPanelHeader'
import type { DoctorPageData } from '@/app/doctor/page'

interface MedicationsAllergiesCardProps {
  medications: DoctorPageData['medications']
  allergies: DoctorPageData['allergies']
}

/*
 * MedicationsAllergiesCard
 *
 * Surfaces the active medication list and known allergies inline on the
 * main doctor brief. The same data lives on /v2/doctor/care-card for the
 * printable emergency summary, but doctors expect to see meds and
 * allergies during the visit without leaving the brief, so we duplicate
 * for visit speed.
 *
 * Position note: this card sits after the data findings panels and
 * before the medication-deltas panel. The reasoning is that a doctor
 * needs the current regimen as anchor before reading "what changed and
 * what shifted after." Allergies sit alongside meds because they are
 * functionally a single "what is in this patient right now" fact.
 *
 * Empty-state surfaces an explicit "no active medications" /
 * "no known allergies" line so a silent collapse does not leave the
 * doctor unsure whether the check ran.
 */
export default function MedicationsAllergiesCard({
  medications,
  allergies,
}: MedicationsAllergiesCardProps) {
  const medCount = medications.length
  const allergyCount = allergies.length

  const medSummary =
    medCount === 0
      ? 'no active medications'
      : `${medCount} medication${medCount === 1 ? '' : 's'} active`
  const allergySummary =
    allergyCount === 0
      ? 'no known allergies'
      : `${allergyCount} ${allergyCount === 1 ? 'allergy' : 'allergies'} on file`
  const summary = `${medSummary}, ${allergySummary}`

  return (
    <Card padding="md">
      <DoctorPanelHeader title="Medications and allergies" summary={summary} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
        <section>
          <h4
            style={{
              margin: '0 0 var(--v2-space-2) 0',
              fontSize: 'var(--v2-text-xs)',
              fontWeight: 'var(--v2-weight-semibold)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--v2-tracking-wide)',
              color: 'var(--v2-text-muted)',
            }}
          >
            Active medications
          </h4>
          {medCount === 0 ? (
            <p
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-muted)',
              }}
            >
              No active medications on file.
            </p>
          ) : (
            <div>
              {medications.map((m, i) => {
                const meta = [m.dose, m.frequency].filter(Boolean).join(' · ')
                return (
                  <ListRow
                    key={`${m.name}-${i}`}
                    label={m.name}
                    subtext={meta || undefined}
                    divider={i !== medications.length - 1}
                  />
                )
              })}
            </div>
          )}
        </section>

        <section>
          <h4
            style={{
              margin: '0 0 var(--v2-space-2) 0',
              fontSize: 'var(--v2-text-xs)',
              fontWeight: 'var(--v2-weight-semibold)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--v2-tracking-wide)',
              color: 'var(--v2-text-muted)',
            }}
          >
            Allergies and sensitivities
          </h4>
          {allergyCount === 0 ? (
            <p
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-muted)',
              }}
            >
              No known allergies on file.
            </p>
          ) : (
            <div>
              {allergies.map((a, i) => (
                <ListRow
                  key={`${a}-${i}`}
                  label={a}
                  divider={i !== allergies.length - 1}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </Card>
  )
}
