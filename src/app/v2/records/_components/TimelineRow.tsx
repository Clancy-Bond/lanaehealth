'use client'

/*
 * TimelineRow (v2 records)
 *
 * Renders a single merged record row using the ListRow primitive. The kind
 * glyph lives in the leading slot, the title is the label, the summary is
 * the subtext, and the short date sits in the trailing slot.
 *
 * A 2px left stripe signals "pay attention" for two cases:
 *   - lab row with severity === 'watch' or 'critical' (abnormal lab)
 *   - problem row with severity === 'watch' (active investigation)
 *
 * No client state, no interactivity of its own. Marked 'use client'
 * because it's rendered from RecordsClient and TimelineGroup, both of
 * which live in the client bundle; explicit 'use client' keeps the
 * bundler honest.
 */
import { ListRow } from '@/v2/components/primitives'
import type { TimelineRow as TimelineRowData } from '@/lib/records/timeline-merge'

const KIND_GLYPH: Record<TimelineRowData['kind'], string> = {
  lab: '🧪',
  imaging: '🩻',
  appointment: '📅',
  event: '📌',
  problem: '🔴',
}

const KIND_LABEL: Record<TimelineRowData['kind'], string> = {
  lab: 'Lab result',
  imaging: 'Imaging study',
  appointment: 'Appointment',
  event: 'Milestone',
  problem: 'Active problem',
}

function formatShortDate(iso: string): string {
  if (iso === '1970-01-01') return ''
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export interface TimelineRowProps {
  row: TimelineRowData
  /** When true, omit the bottom divider (last row in group). */
  isLast?: boolean
}

export default function TimelineRow({ row, isLast = false }: TimelineRowProps) {
  const stripeActive =
    (row.kind === 'lab' && (row.severity === 'watch' || row.severity === 'critical')) ||
    (row.kind === 'problem' && row.severity === 'watch')

  const leading = (
    <span
      aria-label={KIND_LABEL[row.kind]}
      title={KIND_LABEL[row.kind]}
      style={{
        fontSize: 20,
        lineHeight: 1,
        width: 28,
        textAlign: 'center',
        display: 'inline-block',
      }}
    >
      {KIND_GLYPH[row.kind]}
    </span>
  )

  const trailing = row.date && row.date !== '1970-01-01' ? (
    <span
      style={{
        fontVariantNumeric: 'tabular-nums',
        fontSize: 'var(--v2-text-sm)',
        color: 'var(--v2-text-muted)',
        whiteSpace: 'nowrap',
      }}
    >
      {formatShortDate(row.date)}
    </span>
  ) : (
    <span style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-muted)' }}>
      Undated
    </span>
  )

  return (
    <div
      style={{
        position: 'relative',
        paddingLeft: stripeActive ? 'var(--v2-space-3)' : 0,
        borderLeft: stripeActive
          ? '2px solid var(--v2-accent-warning)'
          : '2px solid transparent',
      }}
    >
      <ListRow
        leading={leading}
        label={row.title}
        subtext={row.summary ?? undefined}
        trailing={trailing}
        divider={!isLast}
      />
    </div>
  )
}
