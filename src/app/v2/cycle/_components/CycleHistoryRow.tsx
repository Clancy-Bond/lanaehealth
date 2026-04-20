import { ListRow } from '@/v2/components/primitives'
import type { Cycle } from '@/lib/cycle/cycle-stats'

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export interface CycleHistoryRowProps {
  cycle: Cycle
  meanCycleLength: number | null
}

export default function CycleHistoryRow({ cycle, meanCycleLength }: CycleHistoryRowProps) {
  const length = cycle.lengthDays
  const deviation =
    length != null && meanCycleLength != null ? Math.round(length - meanCycleLength) : null
  const outOfRange = length != null && (length < 21 || length > 35)

  const rangeText = `${fmtDate(cycle.startDate)} – ${fmtDate(cycle.periodEndDate)}`
  const label =
    length != null ? (
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{length} days</span>
    ) : (
      'In progress'
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
