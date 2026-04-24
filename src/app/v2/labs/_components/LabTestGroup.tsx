'use client'

/*
 * LabTestGroup (v2 labs)
 *
 * A Card for one unique test_name. Shows the test name, the latest
 * value + unit + flag, a small "N readings" caption, and : when the
 * series is trendable : a LabSparkline.
 *
 * Trendable means: entries.length >= 2 AND every value is a number AND
 * every entry shares the same unit (mixing units silently would lie
 * about trend shape). When not trendable we just show the latest card,
 * which is still useful as a reference.
 *
 * Marked 'use client' (post polish pass) because the latest value
 * doubles as a tap-to-explain target when the parent passes onExplain.
 */
import { Card } from '@/v2/components/primitives'
import type { LabResult } from '@/lib/types'
import AbnormalFlag from '@/app/v2/_tail-shared/AbnormalFlag'
import LabSparkline from './LabSparkline'

export interface LabGroup {
  name: string
  unit: string | null
  entries: LabResult[]
}

export interface LabTestGroupProps {
  group: LabGroup
  /** When wired, the latest-value pill becomes a tap-to-explain target. */
  onExplain?: (row: LabResult) => void
}

function allNumeric(entries: LabResult[]): entries is (LabResult & { value: number })[] {
  return entries.every((e) => e.value !== null && typeof e.value === 'number')
}

function allShareUnit(entries: LabResult[], unit: string | null): boolean {
  if (!unit) {
    return entries.every((e) => e.unit === null)
  }
  return entries.every((e) => e.unit === unit)
}

export default function LabTestGroup({ group, onExplain }: LabTestGroupProps) {
  // The page sorts entries oldest-first; "latest" is therefore the
  // last element. Mirror legacy /labs so data parity holds.
  const latest = group.entries[group.entries.length - 1]
  const trendable =
    group.entries.length >= 2 &&
    allNumeric(group.entries) &&
    allShareUnit(group.entries, group.unit)

  const valuePill = (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--v2-space-2)',
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
        {latest.value ?? '-'}
        {group.unit && (
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
              marginLeft: 3,
              fontWeight: 'var(--v2-weight-medium)',
            }}
          >
            {group.unit}
          </span>
        )}
      </span>
      <AbnormalFlag flag={latest.flag} />
    </span>
  )

  // Wrap the value pill in a button when the parent wires onExplain.
  // Keeps the visual identical, just enables the tap target. Min 44pt
  // height so iOS HIG is honored without padding the card.
  const valueTrailing = onExplain ? (
    <button
      type="button"
      onClick={() => onExplain(latest)}
      aria-label={`Explain ${group.name} latest value`}
      style={{
        background: 'transparent',
        border: 0,
        padding: 0,
        cursor: 'pointer',
        color: 'inherit',
        fontFamily: 'inherit',
        minHeight: 44,
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      {valuePill}
    </button>
  ) : (
    valuePill
  )

  return (
    <Card padding="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 'var(--v2-space-3)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--v2-text-lg)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
          >
            {group.name}
          </span>
          {valueTrailing}
        </div>

        {trendable && <LabSparkline entries={group.entries} unit={group.unit} />}

        <div
          style={{
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {group.entries.length} {group.entries.length === 1 ? 'reading' : 'readings'}
        </div>
      </div>
    </Card>
  )
}
