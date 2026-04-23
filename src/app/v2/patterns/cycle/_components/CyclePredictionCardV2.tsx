/**
 * CyclePredictionCardV2
 *
 * Next-period and fertile-window predictions reframed in the v2
 * explanatory surface. Every number includes its source so the
 * reader never sees a bare date.
 */
import type { PeriodPrediction, FertileWindowPrediction } from '@/lib/cycle/period-prediction'
import { Card } from '@/v2/components/primitives'

export interface CyclePredictionCardV2Props {
  period: PeriodPrediction
  fertile: FertileWindowPrediction
  meanCycleLength: number | null
  sdCycleLength: number | null
  completedCycles: number
}

function formatRange(start: string | null, end: string | null): string {
  if (!start || !end) return ''
  const fmt = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(start)} to ${fmt(end)}`
}

export default function CyclePredictionCardV2({
  period,
  fertile,
  meanCycleLength,
  sdCycleLength,
  completedCycles,
}: CyclePredictionCardV2Props) {
  const hasBasis = meanCycleLength != null && completedCycles >= 2
  const basisClause = hasBasis
    ? `Based on your last ${Math.min(completedCycles, 6)} cycles, ${meanCycleLength.toFixed(1)} days average${sdCycleLength != null ? `, give or take ${sdCycleLength.toFixed(1)}` : ''}.`
    : 'Predictions tighten after a few more logged cycles.'

  return (
    <Card variant="explanatory" padding="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
        <div>
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-surface-explanatory-muted)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--v2-tracking-wide)',
              fontWeight: 'var(--v2-weight-medium)',
            }}
          >
            Next period
          </span>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-lg)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-surface-explanatory-text)',
              lineHeight: 'var(--v2-leading-normal)',
            }}
          >
            {period.rangeStart && period.rangeEnd
              ? `Expected ${formatRange(period.rangeStart, period.rangeEnd)}`
              : 'Not enough data to predict yet'}
          </p>
        </div>

        <div>
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-surface-explanatory-muted)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--v2-tracking-wide)',
              fontWeight: 'var(--v2-weight-medium)',
            }}
          >
            Fertile window
          </span>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-lg)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-surface-explanatory-text)',
              lineHeight: 'var(--v2-leading-normal)',
            }}
          >
            {fertile.rangeStart && fertile.rangeEnd
              ? formatRange(fertile.rangeStart, fertile.rangeEnd)
              : 'Not enough data to predict yet'}
          </p>
        </div>

        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-surface-explanatory-muted)',
            lineHeight: 'var(--v2-leading-normal)',
          }}
        >
          {basisClause} The window widens when cycles vary more.
        </p>
      </div>
    </Card>
  )
}
