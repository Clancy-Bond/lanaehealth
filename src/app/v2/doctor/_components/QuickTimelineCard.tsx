import { Card } from '@/v2/components/primitives'
import DoctorPanelHeader from './DoctorPanelHeader'
import type { MedicalTimelineEvent } from '@/lib/types'

interface QuickTimelineCardProps {
  events: MedicalTimelineEvent[]
}

function formatEventDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function dotColor(sig: string): string {
  if (sig === 'critical') return 'var(--v2-accent-danger)'
  if (sig === 'important') return 'var(--v2-accent-warning)'
  return 'var(--v2-accent-primary)'
}

/*
 * QuickTimelineCard
 *
 * Recent-first timeline of important and critical events. The doctor
 * looking at "Apr 7 syncope · Feb 12 Accutane start · Jan 8 fainting"
 * gets the narrative arc in three seconds. Dotted rail with colored
 * dots keeps critical events visually distinct from important ones.
 */
export default function QuickTimelineCard({ events }: QuickTimelineCardProps) {
  if (events.length === 0) return null
  const top = events.slice(0, 8)
  const critical = events.filter((e) => e.significance === 'critical').length
  const summary =
    critical > 0
      ? `${critical} critical event${critical === 1 ? '' : 's'} in recent timeline`
      : `${events.length} important event${events.length === 1 ? '' : 's'}`

  return (
    <Card padding="md">
      <DoctorPanelHeader title="Recent medical timeline" summary={summary} />
      <ol
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-3)',
        }}
      >
        {top.map((e) => (
          <li key={e.id} style={{ display: 'flex', gap: 'var(--v2-space-3)' }}>
            <div
              aria-hidden
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: dotColor(e.significance),
                flexShrink: 0,
                marginTop: 6,
                boxShadow: `0 0 0 3px color-mix(in srgb, ${dotColor(e.significance)} 15%, transparent)`,
              }}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--v2-space-2)' }}>
                <span
                  style={{
                    fontSize: 'var(--v2-text-sm)',
                    fontWeight: 'var(--v2-weight-semibold)',
                    color: 'var(--v2-text-primary)',
                  }}
                >
                  {e.title}
                </span>
                <span
                  style={{
                    fontSize: 'var(--v2-text-xs)',
                    color: 'var(--v2-text-muted)',
                    whiteSpace: 'nowrap',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatEventDate(e.event_date)}
                </span>
              </div>
              {e.description && (
                <p
                  style={{
                    margin: '2px 0 0 0',
                    fontSize: 'var(--v2-text-sm)',
                    color: 'var(--v2-text-secondary)',
                    lineHeight: 'var(--v2-leading-normal)',
                  }}
                >
                  {e.description}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  )
}
