import { Card, ListRow } from '@/v2/components/primitives'
import DoctorPanelHeader from './DoctorPanelHeader'
import type { FollowThroughItem } from '@/lib/doctor/follow-through'

interface FollowThroughCardProps {
  items: FollowThroughItem[]
}

function formatDue(item: FollowThroughItem): string {
  if (item.daysOverdue === 0) return 'Due today'
  if (item.daysOverdue > 0) return `${item.daysOverdue} days overdue`
  return `Due in ${Math.abs(item.daysOverdue)} days`
}

function intentFor(item: FollowThroughItem): 'warning' | 'default' {
  return item.daysOverdue > 0 ? 'warning' : 'default'
}

/*
 * FollowThroughCard
 *
 * Action items from previous visits. Overdue ones surface as warning
 * color; future ones stay muted. The doctor can ask "did you do X?"
 * without having to dig back through notes.
 */
export default function FollowThroughCard({ items }: FollowThroughCardProps) {
  if (items.length === 0) return null
  const overdue = items.filter((i) => i.daysOverdue > 0).length
  const summary =
    overdue > 0
      ? `${overdue} overdue of ${items.length}`
      : `${items.length} open action ${items.length === 1 ? 'item' : 'items'}`

  return (
    <Card padding="md">
      <DoctorPanelHeader title="Follow-through from prior visits" summary={summary} />
      <div>
        {items.map((i, idx) => (
          <ListRow
            key={`${i.appointmentId}-${idx}`}
            label={i.item}
            subtext={`${i.specialty ?? 'Visit'} on ${i.appointmentDate}${i.doctorName ? ` · ${i.doctorName}` : ''}`}
            trailing={formatDue(i)}
            intent={intentFor(i)}
            divider={idx !== items.length - 1}
          />
        ))}
      </div>
    </Card>
  )
}
