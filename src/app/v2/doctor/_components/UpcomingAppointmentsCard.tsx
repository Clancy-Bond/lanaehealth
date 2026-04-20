import { Card, ListRow } from '@/v2/components/primitives'
import DoctorPanelHeader from './DoctorPanelHeader'
import type { Appointment } from '@/lib/types'

interface UpcomingAppointmentsCardProps {
  appointments: Appointment[]
}

function formatApptDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function daysUntil(iso: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(iso + 'T00:00:00')
  const diffMs = target.getTime() - today.getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

/*
 * UpcomingAppointmentsCard
 *
 * Shows the next 3 scheduled visits. The first one is the visit the
 * doctor is likely about to conduct, which is why it ranks this
 * card near the top of the brief.
 */
export default function UpcomingAppointmentsCard({ appointments }: UpcomingAppointmentsCardProps) {
  if (appointments.length === 0) return null
  const top = appointments.slice(0, 3)
  const next = top[0]
  const daysOut = daysUntil(next.date)
  const summary =
    daysOut === 0
      ? 'Next visit is today'
      : daysOut === 1
        ? 'Next visit is tomorrow'
        : `Next visit in ${daysOut} days`

  return (
    <Card padding="md">
      <DoctorPanelHeader title="Upcoming appointments" summary={summary} />
      <div>
        {top.map((a, i) => (
          <ListRow
            key={`${a.date}-${a.specialty ?? 'visit'}`}
            label={a.specialty ?? 'Visit'}
            subtext={a.doctor_name ?? a.reason ?? undefined}
            trailing={formatApptDate(a.date)}
            divider={i !== top.length - 1}
          />
        ))}
      </div>
    </Card>
  )
}
