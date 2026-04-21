/*
 * BPRecentList
 *
 * Last 20 readings as a stack of ListRows. Label is the headline
 * value ("120/80"), subtext is date + position (+ notes on a second
 * line), trailing is the classification pill so the "pay attention"
 * signal lines up visually across rows.
 *
 * The latest-card already highlights the newest reading, so this
 * list focuses on the trend-at-a-glance : keep the subtext compact.
 */
import { format, parseISO } from 'date-fns'
import { Card, ListRow } from '@/v2/components/primitives'
import {
  classifyBP,
  type BloodPressureEntry,
} from '@/lib/calories/blood-pressure'

export interface BPRecentListProps {
  entries: BloodPressureEntry[]
}

export default function BPRecentList({ entries }: BPRecentListProps) {
  if (entries.length === 0) return null

  const rows = entries.slice(0, 20)

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-3)',
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-xs)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--v2-tracking-wide)',
          color: 'var(--v2-text-muted)',
          fontWeight: 'var(--v2-weight-semibold)',
        }}
      >
        Recent readings
      </h2>
      <Card padding="none">
        <div style={{ padding: '0 var(--v2-space-4)' }}>
          {rows.map((e, i) => {
            const cls = classifyBP(e.systolic, e.diastolic)
            const dateLabel = format(parseISO(e.date + 'T00:00:00'), 'MMM d')
            const positionLabel =
              e.position !== 'unknown' ? e.position : null
            const subtextMain = [
              e.time ? `${dateLabel} · ${e.time}` : dateLabel,
              positionLabel,
              e.pulse !== null ? `pulse ${e.pulse}` : null,
            ]
              .filter(Boolean)
              .join(' · ')
            return (
              <ListRow
                key={e.id}
                label={
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {e.systolic}/{e.diastolic}
                    <span
                      style={{
                        fontSize: 'var(--v2-text-sm)',
                        color: 'var(--v2-text-muted)',
                        marginLeft: 4,
                        fontWeight: 'var(--v2-weight-regular)',
                      }}
                    >
                      mmHg
                    </span>
                  </span>
                }
                subtext={
                  <span>
                    {subtextMain}
                    {e.notes ? (
                      <span
                        style={{
                          display: 'block',
                          marginTop: 2,
                          color: 'var(--v2-text-muted)',
                        }}
                      >
                        {e.notes}
                      </span>
                    ) : null}
                  </span>
                }
                trailing={
                  <span
                    style={{
                      padding: '3px 8px',
                      borderRadius: 'var(--v2-radius-full)',
                      background: cls.color,
                      color: '#FFFFFF',
                      fontSize: 11,
                      fontWeight: 'var(--v2-weight-semibold)',
                      textTransform: 'uppercase',
                      letterSpacing: 'var(--v2-tracking-wide)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {cls.label}
                  </span>
                }
                divider={i < rows.length - 1}
              />
            )
          })}
        </div>
      </Card>
    </section>
  )
}
