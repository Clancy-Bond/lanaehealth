/*
 * TimelineGroup (v2 records)
 *
 * One month section: sticky-feeling eyebrow label, then a Card wrapping
 * every row that belongs to that month. Rows carry dividers except for
 * the last one, which matches the Oura list pattern (frame_0150).
 *
 * Pure presentational server component. No state.
 */
import { Card } from '@/v2/components/primitives'
import type { TimelineRow as TimelineRowData } from '@/lib/records/timeline-merge'
import TimelineRow from './TimelineRow'

export interface TimelineGroupProps {
  label: string
  rows: TimelineRowData[]
}

export default function TimelineGroup({ label, rows }: TimelineGroupProps) {
  if (rows.length === 0) return null
  return (
    <section aria-label={label} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--v2-space-2)',
          paddingLeft: 'var(--v2-space-1)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--v2-text-xs)',
            fontWeight: 'var(--v2-weight-semibold)',
            color: 'var(--v2-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--v2-tracking-wide)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {label}
        </span>
        <span
          aria-hidden="true"
          style={{
            flex: 1,
            height: 1,
            background: 'var(--v2-border-subtle)',
          }}
        />
      </div>
      <Card padding="none">
        <div style={{ padding: '0 var(--v2-space-4)' }}>
          {rows.map((row, idx) => (
            <TimelineRow key={row.id} row={row} isLast={idx === rows.length - 1} />
          ))}
        </div>
      </Card>
    </section>
  )
}
