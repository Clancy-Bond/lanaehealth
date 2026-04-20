/*
 * WeightCurrentCard
 *
 * Headline weight number + three comparison deltas (last week, last
 * month, to target). Pure presentational: all math is done at the
 * page level and passed down. Voice is NC-register: "Up" and "Down"
 * in the visible copy; no judgement verbs. Holding steady is a
 * first-class state for small fluctuations (< 0.1 lb after rounding).
 */
import { format } from 'date-fns'
import { Card } from '@/v2/components/primitives'

export interface WeightCurrentCardProps {
  /** Latest weigh-in in lb, or null if the log is empty. */
  latestLb: number | null
  /** ISO date of the latest weigh-in, for the eyebrow label. */
  latestDate: string | null
  /** True when latestDate equals today's ISO. Drives "Today" vs "As of ...". */
  isToday: boolean
  /** lb one week before the latest entry (or closest prior); null if absent. */
  weekAgoLb: number | null
  /** lb one month before the latest entry (or closest prior); null if absent. */
  monthAgoLb: number | null
  /** Target weight in lb, or null if no goal set. */
  targetLb: number | null
}

function formatDelta(current: number, prior: number | null): string | null {
  if (prior === null) return null
  const diff = current - prior
  const abs = Math.abs(diff)
  if (abs < 0.1) return 'Holding steady'
  return diff > 0 ? `Up ${abs.toFixed(1)} lb` : `Down ${abs.toFixed(1)} lb`
}

function formatWindowLabel(current: number, prior: number | null, window: string): string {
  const base = formatDelta(current, prior)
  if (base === null) return `No reading from ${window} yet`
  if (base === 'Holding steady') return `Holding steady since ${window}`
  return `${base} from ${window}`
}

function formatTargetGap(current: number, targetLb: number | null): string | null {
  if (targetLb === null) return null
  const diff = targetLb - current
  const abs = Math.abs(diff)
  if (abs < 0.1) return 'At target'
  return `${abs.toFixed(1)} lb to target`
}

export default function WeightCurrentCard({
  latestLb,
  latestDate,
  isToday,
  weekAgoLb,
  monthAgoLb,
  targetLb,
}: WeightCurrentCardProps) {
  if (latestLb === null || latestDate === null) return null
  const eyebrow = isToday
    ? 'Today'
    : `As of ${format(new Date(latestDate + 'T00:00:00'), 'MMM d')}`

  const weekLabel = formatWindowLabel(latestLb, weekAgoLb, 'last week')
  const monthLabel = formatWindowLabel(latestLb, monthAgoLb, 'last month')
  const targetLabel = formatTargetGap(latestLb, targetLb)

  return (
    <Card padding="md">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-4)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--v2-tracking-wide)',
            }}
          >
            {eyebrow}
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 'var(--v2-space-2)',
            }}
          >
            <span
              style={{
                fontSize: 'var(--v2-text-3xl)',
                fontWeight: 'var(--v2-weight-bold)',
                color: 'var(--v2-text-primary)',
                letterSpacing: 'var(--v2-tracking-tight)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {latestLb.toFixed(1)}
            </span>
            <span
              style={{
                fontSize: 'var(--v2-text-base)',
                color: 'var(--v2-text-secondary)',
                fontWeight: 'var(--v2-weight-medium)',
              }}
            >
              lb
            </span>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--v2-space-2) var(--v2-space-4)',
          }}
        >
          <DeltaChip label={weekLabel} />
          <DeltaChip label={monthLabel} />
          {targetLabel && <DeltaChip label={targetLabel} />}
        </div>
      </div>
    </Card>
  )
}

function DeltaChip({ label }: { label: string }) {
  return (
    <span
      style={{
        fontSize: 'var(--v2-text-sm)',
        color: 'var(--v2-text-secondary)',
        lineHeight: 'var(--v2-leading-normal)',
      }}
    >
      {label}
    </span>
  )
}
