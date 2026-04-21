'use client'

import { Card } from '@/v2/components/primitives'
import DoctorPanelHeader from './DoctorPanelHeader'
import { useCrossAppointmentCoverage } from './useCrossAppointmentCoverage'
import type { DoctorPageData } from '@/app/doctor/page'
import type { SpecialistView } from '@/lib/doctor/specialist-config'

interface CrossAppointmentCardProps {
  data: DoctorPageData
  view: SpecialistView
}

function formatApptDate(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00')
  const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  if (days === 0) return `${label} (today)`
  if (days === 1) return `${label} (tomorrow)`
  if (days < 0) return `${label}`
  return `${label} (in ${days}d)`
}

/*
 * CrossAppointmentCard
 *
 * Which upcoming visit is positioned to evaluate each hypothesis.
 * Hypotheses with "no one is looking at this" get a muted badge so
 * the doctor in front of Lanae today can decide whether to take it
 * on or refer out.
 */
export default function CrossAppointmentCard({ data, view }: CrossAppointmentCardProps) {
  const coverage = useCrossAppointmentCoverage(data, view)
  if (coverage.length === 0) return null
  const summary = `${coverage.length} hypothes${coverage.length === 1 ? 'is' : 'es'} with upcoming coverage`

  return (
    <Card padding="md">
      <DoctorPanelHeader title="Cross-appointment coverage" summary={summary} />
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
        {coverage.map((c) => (
          <li
            key={c.hypothesisName}
            style={{
              padding: 'var(--v2-space-2) 0',
              borderBottom: '1px solid var(--v2-border-subtle)',
            }}
          >
            <div
              style={{
                fontSize: 'var(--v2-text-sm)',
                fontWeight: 'var(--v2-weight-semibold)',
                color: 'var(--v2-text-primary)',
                marginBottom: 2,
              }}
            >
              {c.hypothesisName}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--v2-space-2)' }}>
              {c.evaluatingAppointments.map((a, i) => (
                <span
                  key={`${a.specialty}-${a.date}-${i}`}
                  style={{
                    fontSize: 'var(--v2-text-xs)',
                    padding: 'var(--v2-space-1) var(--v2-space-2)',
                    borderRadius: 'var(--v2-radius-sm)',
                    background: a.isCurrentView ? 'var(--v2-accent-primary-soft)' : 'var(--v2-bg-elevated)',
                    color: a.isCurrentView ? 'var(--v2-accent-primary)' : 'var(--v2-text-secondary)',
                    fontWeight: a.isCurrentView ? 'var(--v2-weight-semibold)' : 'var(--v2-weight-regular)',
                  }}
                >
                  {a.specialty} · {formatApptDate(a.date, a.daysAway)}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
