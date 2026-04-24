import { ListRow } from '@/v2/components/primitives'
import type { Cycle } from '@/lib/cycle/cycle-stats'

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export interface CycleHistoryRowProps {
  cycle: Cycle
  meanCycleLength: number | null
  /**
   * True when BBT never sustained a rise above the cover line for this
   * entire cycle, per detectAnovulatoryCycle. Renders an "Anovulatory"
   * badge so the reader can spot patterns over time.
   */
  anovulatory?: boolean
}

export default function CycleHistoryRow({
  cycle,
  meanCycleLength,
  anovulatory = false,
}: CycleHistoryRowProps) {
  const length = cycle.lengthDays
  const deviation =
    length != null && meanCycleLength != null ? Math.round(length - meanCycleLength) : null
  const outOfRange = length != null && (length < 21 || length > 35)

  const rangeText = `${fmtDate(cycle.startDate)} – ${fmtDate(cycle.periodEndDate)}`
  const label = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--v2-space-2)' }}>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        {length != null ? `${length} days` : 'In progress'}
      </span>
      {anovulatory && (
        <span
          aria-label="No ovulation detected this cycle"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 8px',
            borderRadius: 'var(--v2-radius-full)',
            border: '1px solid var(--v2-border-subtle)',
            background: 'rgba(229, 201, 82, 0.08)',
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-secondary)',
            fontWeight: 'var(--v2-weight-medium)',
            lineHeight: 1.3,
            whiteSpace: 'nowrap',
          }}
        >
          Anovulatory
        </span>
      )}
    </span>
  )
  const subtext = (
    <span>
      {rangeText}
      {cycle.periodDays > 0 && <> · {cycle.periodDays}d period</>}
    </span>
  )

  const trailing =
    deviation != null ? (
      <span style={{ fontVariantNumeric: 'tabular-nums', color: outOfRange ? 'var(--v2-accent-warning)' : 'var(--v2-text-muted)' }}>
        {deviation > 0 ? `+${deviation}` : deviation}d
      </span>
    ) : undefined

  return (
    <ListRow
      label={label}
      subtext={subtext}
      trailing={trailing}
      intent={outOfRange ? 'warning' : 'default'}
    />
  )
}
