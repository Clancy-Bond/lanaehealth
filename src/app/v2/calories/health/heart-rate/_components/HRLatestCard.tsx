/*
 * HRLatestCard
 *
 * Most-recent spot-check hero. Empty-state points kindly at the form
 * below (NC voice). Unlike BP, HR doesn't get a classification pill :
 * the meaning of a given bpm depends entirely on context (standing
 * after an orthostatic push vs. resting), so we surface the context
 * label instead of an independent "High / Normal" verdict.
 */
import { format, parseISO } from 'date-fns'
import { Card, EmptyState } from '@/v2/components/primitives'
import {
  hrContextLabel,
  type HeartRateEntry,
} from '@/lib/calories/heart-rate'

export interface HRLatestCardProps {
  latest: HeartRateEntry | null
}

export default function HRLatestCard({ latest }: HRLatestCardProps) {
  if (!latest) {
    return (
      <Card padding="md">
        <EmptyState
          headline="No readings yet."
          subtext="Log one below to see your trend."
        />
      </Card>
    )
  }

  const whenLabel = format(
    parseISO(latest.date + 'T00:00:00'),
    'EEE MMM d',
  )

  return (
    <Card
      padding="md"
      style={{
        borderLeft: '3px solid var(--v2-accent-primary)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-1)',
        }}
      >
        <div
          style={{
            fontSize: 'var(--v2-text-xs)',
            fontWeight: 'var(--v2-weight-semibold)',
            color: 'var(--v2-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--v2-tracking-wide)',
          }}
        >
          Most recent
        </div>
        <div
          style={{
            fontSize: 'var(--v2-text-3xl)',
            fontWeight: 'var(--v2-weight-bold)',
            color: 'var(--v2-text-primary)',
            lineHeight: 'var(--v2-leading-tight)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {latest.bpm}
          <span
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-muted)',
              marginLeft: 6,
              fontWeight: 'var(--v2-weight-medium)',
            }}
          >
            bpm
          </span>
        </div>
        <div
          style={{
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-muted)',
            marginTop: 4,
          }}
        >
          {whenLabel}
          {latest.time ? ` · ${latest.time}` : ''} ·{' '}
          {hrContextLabel(latest.context)}
        </div>
      </div>
    </Card>
  )
}
