import { Card } from '@/v2/components/primitives'
import DoctorPanelHeader from './DoctorPanelHeader'
import type { DoctorPageData } from '@/app/doctor/page'

interface SinceLastVisitCardProps {
  data: DoctorPageData
}

function formatDate(iso: string | null): string {
  if (!iso) return 'no prior visit on record'
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/*
 * SinceLastVisitCard
 *
 * Opens most real visits: "here's what's changed since we saw each
 * other." We summarize by counting new-since-last events in each
 * category (timeline, labs, imaging, med changes) without filtering
 * by date — the server already gives us recent-first data.
 */
export default function SinceLastVisitCard({ data }: SinceLastVisitCardProps) {
  const lastDate = data.lastAppointmentDate
  if (!lastDate) return null

  const cutoff = new Date(lastDate + 'T00:00:00').getTime()
  const newTimeline = data.timelineEvents.filter((e) => new Date(e.event_date).getTime() > cutoff).length
  const newImaging = data.imagingStudies.filter((s) => new Date(s.study_date).getTime() > cutoff).length
  const newMedChanges = data.medicationDeltas.filter((m) => new Date(m.eventDate).getTime() > cutoff).length
  const newLabs = data.abnormalLabs.filter((l) => new Date(l.date).getTime() > cutoff).length

  const totalChanges = newTimeline + newImaging + newMedChanges + newLabs
  const summary =
    totalChanges === 0
      ? `No new findings since ${formatDate(lastDate)}`
      : `${totalChanges} new finding${totalChanges === 1 ? '' : 's'} since ${formatDate(lastDate)}`

  const bits: Array<{ label: string; count: number }> = [
    { label: 'timeline events', count: newTimeline },
    { label: 'imaging studies', count: newImaging },
    { label: 'medication changes', count: newMedChanges },
    { label: 'abnormal labs', count: newLabs },
  ].filter((b) => b.count > 0)

  return (
    <Card padding="md">
      <DoctorPanelHeader title="Since last visit" summary={summary} />
      {bits.length === 0 ? (
        <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)' }}>
          Nothing new to report. Baseline unchanged.
        </p>
      ) : (
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
          {bits.map((b) => (
            <li
              key={b.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-secondary)',
                padding: 'var(--v2-space-2) 0',
                borderBottom: '1px solid var(--v2-border-subtle)',
              }}
            >
              <span>{b.label}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--v2-text-primary)', fontWeight: 'var(--v2-weight-semibold)' }}>
                {b.count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
