/*
 * HRRecentList
 *
 * Last 20 HR spot-checks as ListRows. Label is the bpm value, subtext
 * is date + context (+ notes on a second line), trailing is the bpm
 * number in teal so the scan-down reads as "was 80, 88, 84, 96…"
 * without each row re-stating the unit.
 */
import { format, parseISO } from 'date-fns'
import { Card, ListRow } from '@/v2/components/primitives'
import {
  hrContextLabel,
  type HeartRateEntry,
} from '@/lib/calories/heart-rate'

export interface HRRecentListProps {
  entries: HeartRateEntry[]
}

export default function HRRecentList({ entries }: HRRecentListProps) {
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
            const dateLabel = format(parseISO(e.date + 'T00:00:00'), 'MMM d')
            const datePart = e.time ? `${dateLabel} · ${e.time}` : dateLabel
            const subtextMain = `${datePart} · ${hrContextLabel(e.context)}`
            return (
              <ListRow
                key={e.id}
                label={
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {e.bpm}
                    <span
                      style={{
                        fontSize: 'var(--v2-text-sm)',
                        color: 'var(--v2-text-muted)',
                        marginLeft: 4,
                        fontWeight: 'var(--v2-weight-regular)',
                      }}
                    >
                      bpm
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
                divider={i < rows.length - 1}
              />
            )
          })}
        </div>
      </Card>
    </section>
  )
}
