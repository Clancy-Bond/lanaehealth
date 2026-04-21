/*
 * LabRow (v2 labs)
 *
 * Renders a single lab row using the ListRow primitive. Layout:
 *   - leading: none (keep the list dense)
 *   - label:   test_name
 *   - subtext: "${date} · ${category}"
 *   - trailing: value + unit stacked over AbnormalFlag pill
 *
 * Matches the /labs legacy row contract but under the v2 dark chrome.
 * Used from LabAbnormalList (Card with dividers) and from the future
 * shared lab lists : it takes one row and does not know about grouping.
 */
import { format, parseISO } from 'date-fns'
import { ListRow } from '@/v2/components/primitives'
import type { LabResult } from '@/lib/types'
import AbnormalFlag from '@/app/v2/_tail-shared/AbnormalFlag'

export interface LabRowProps {
  row: LabResult
  /** When true, omit the bottom divider (last row in group). */
  isLast?: boolean
}

function formatLabDate(iso: string): string {
  // Anchor to local midnight so dates render consistently across tz.
  return format(parseISO(iso + 'T00:00:00'), 'MMM d, yyyy')
}

export default function LabRow({ row, isLast = false }: LabRowProps) {
  const subtextParts = [formatLabDate(row.date)]
  if (row.category) subtextParts.push(row.category)

  const trailing = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 'var(--v2-space-1)',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          fontSize: 'var(--v2-text-base)',
          fontWeight: 'var(--v2-weight-semibold)',
          color: 'var(--v2-text-primary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {row.value ?? '-'}
        {row.unit && (
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
              marginLeft: 3,
              fontWeight: 'var(--v2-weight-medium)',
            }}
          >
            {row.unit}
          </span>
        )}
      </span>
      <AbnormalFlag flag={row.flag} />
    </div>
  )

  return (
    <ListRow
      label={row.test_name}
      subtext={subtextParts.join(' · ')}
      trailing={trailing}
      divider={!isLast}
    />
  )
}
