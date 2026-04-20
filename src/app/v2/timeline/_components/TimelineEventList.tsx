/**
 * TimelineEventList
 *
 * Events grouped by year, descending. Each group has a large year
 * heading so the reader can locate themselves with a thumb scroll.
 */
import type { MedicalTimelineEvent } from '@/lib/types'
import TimelineEventCard from './TimelineEventCard'

export interface TimelineEventListProps {
  events: MedicalTimelineEvent[]
}

function groupByYear(events: MedicalTimelineEvent[]): Array<{ year: number; events: MedicalTimelineEvent[] }> {
  const map = new Map<number, MedicalTimelineEvent[]>()
  for (const e of events) {
    const y = Number(e.event_date.slice(0, 4))
    const bucket = map.get(y) ?? []
    bucket.push(e)
    map.set(y, bucket)
  }
  return Array.from(map.entries())
    .map(([year, events]) => ({ year, events }))
    .sort((a, b) => b.year - a.year)
}

export default function TimelineEventList({ events }: TimelineEventListProps) {
  const groups = groupByYear(events)
  if (groups.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-5)' }}>
      {groups.map((group) => (
        <section key={group.year} aria-label={`Year ${group.year}`}>
          <h2
            style={{
              margin: 0,
              marginBottom: 'var(--v2-space-3)',
              fontSize: 'var(--v2-text-lg)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-secondary)',
              letterSpacing: 'var(--v2-tracking-tight)',
            }}
          >
            {group.year}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
            {group.events.map((e) => (
              <TimelineEventCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
