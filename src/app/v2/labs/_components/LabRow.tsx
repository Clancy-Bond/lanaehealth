/*
 * LabRow (v2 labs)
 *
 * Renders a single lab row using the ListRow primitive. Layout:
 *   - leading: none (keep the list dense)
 *   - label:   test_name
 *   - subtext: "${date} · ${category}"
 *   - trailing: value + unit stacked over AbnormalFlag pill
 *
 * Severity wrapper (post polish pass): rows with a non-normal flag
 * carry a 2px left stripe so the eye can scan the column for trouble
 * without parsing every pill. Critical rows additionally get a faint
 * danger-hue background tint that lifts them above mere "high" /
 * "low" rows. Matches the TimelineRow pattern in v2/records.
 *
 * Tap-to-explain: when onExplain is wired, the trailing block becomes
 * a button so the user can ask "what does Low mean for this test?".
 * The explainer copy lives in the parent (LabsClient owns the modal).
 */
import { format, parseISO } from 'date-fns'
import { ListRow } from '@/v2/components/primitives'
import type { LabResult } from '@/lib/types'
import AbnormalFlag from '@/app/v2/_tail-shared/AbnormalFlag'

export interface LabRowProps {
  row: LabResult
  /** When true, omit the bottom divider (last row in group). */
  isLast?: boolean
  /** Wire a tap-to-explain handler; renders the trailing as a button. */
  onExplain?: (row: LabResult) => void
}

function formatLabDate(iso: string): string {
  // Anchor to local midnight so dates render consistently across tz.
  return format(parseISO(iso + 'T00:00:00'), 'MMM d, yyyy')
}

export default function LabRow({ row, isLast = false, onExplain }: LabRowProps) {
  const subtextParts = [formatLabDate(row.date)]
  if (row.category) subtextParts.push(row.category)

  const isAbnormal = row.flag != null && row.flag !== 'normal'
  const isCritical = row.flag === 'critical'

  const valueBlock = (
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

  // When onExplain is wired, wrap the trailing block in a tap target
  // so the user can ask "what does this flag mean?". 44pt min height
  // is enforced by the inline button.
  const trailing = onExplain ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onExplain(row)
      }}
      aria-label={`Explain ${row.test_name} value`}
      style={{
        background: 'transparent',
        border: 0,
        padding: 0,
        cursor: 'pointer',
        color: 'inherit',
        fontFamily: 'inherit',
        minHeight: 44,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {valueBlock}
    </button>
  ) : (
    valueBlock
  )

  // Stripe + tint mirror the TimelineRow severity wrapper in v2/records,
  // and the danger-hue tint for critical matches the AbnormalFlag's
  // critical pill. Background stays transparent for low/high so the row
  // feels light; only critical earns the surface tint.
  const stripeColor = isCritical
    ? 'var(--v2-accent-danger)'
    : isAbnormal
      ? 'var(--v2-accent-warning)'
      : 'transparent'

  return (
    <div
      style={{
        position: 'relative',
        paddingLeft: isAbnormal ? 'var(--v2-space-3)' : 0,
        marginLeft: isAbnormal ? 'calc(-1 * var(--v2-space-3))' : 0,
        marginRight: isAbnormal ? 'calc(-1 * var(--v2-space-3))' : 0,
        paddingRight: isAbnormal ? 'var(--v2-space-3)' : 0,
        borderLeft: `2px solid ${stripeColor}`,
        background: isCritical ? 'rgba(239, 93, 93, 0.05)' : 'transparent',
        borderRadius: isCritical ? 'var(--v2-radius-sm)' : 0,
      }}
    >
      <ListRow
        label={row.test_name}
        subtext={subtextParts.join(' · ')}
        trailing={trailing}
        divider={!isLast}
      />
    </div>
  )
}
