/*
 * LabAbnormalList (v2 labs)
 *
 * Renders the top-30 abnormal-first LabRows inside a Card with
 * dividers. Same visual language as the TimelineGroup in /v2/records
 * : Card(padding="none") wrapping padded rows, dividers between,
 * no divider on the last row.
 *
 * Purely presentational. Safe as a server component because it just
 * fans LabRow children (also server components).
 */
import { Card } from '@/v2/components/primitives'
import type { LabResult } from '@/lib/types'
import LabRow from './LabRow'

export interface LabAbnormalListProps {
  rows: LabResult[]
}

export default function LabAbnormalList({ rows }: LabAbnormalListProps) {
  if (rows.length === 0) return null
  return (
    <Card padding="none">
      <div style={{ padding: '0 var(--v2-space-4)' }}>
        {rows.map((row, idx) => (
          <LabRow key={row.id} row={row} isLast={idx === rows.length - 1} />
        ))}
      </div>
    </Card>
  )
}
