/*
 * BPLatestCard
 *
 * Most-recent-reading hero. Renders an EmptyState when no readings
 * exist yet (NC-style voice : kind, points at the form below).
 *
 * Classification pill uses the exact color tuple returned by
 * classifyBP() so the "pay attention" signal matches the legacy route
 * and any future analysis overlay. Pill text is forced white because
 * the classifier's background colors (sage, blush, phase-luteal) all
 * read darker than card text by design.
 */
import { format, parseISO } from 'date-fns'
import { Card, EmptyState } from '@/v2/components/primitives'
import {
  classifyBP,
  type BloodPressureEntry,
} from '@/lib/calories/blood-pressure'
import {
  calculateMAP,
  calculatePulsePressure,
} from '@/lib/calories/body-metrics'

export interface BPLatestCardProps {
  latest: BloodPressureEntry | null
}

export default function BPLatestCard({ latest }: BPLatestCardProps) {
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

  const cls = classifyBP(latest.systolic, latest.diastolic)
  const whenLabel = format(
    parseISO(latest.date + 'T00:00:00'),
    'EEE MMM d',
  )
  const positionLabel =
    latest.position !== 'unknown' ? latest.position : null

  return (
    <Card
      padding="md"
      style={{
        borderLeft: `3px solid ${cls.color}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--v2-space-3)',
        }}
      >
        <div style={{ minWidth: 0 }}>
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
            {latest.systolic}
            <span
              style={{
                fontSize: 'var(--v2-text-xl)',
                color: 'var(--v2-text-muted)',
              }}
            >
              {' / '}
            </span>
            {latest.diastolic}
            <span
              style={{
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-muted)',
                marginLeft: 6,
                fontWeight: 'var(--v2-weight-medium)',
              }}
            >
              mmHg
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
            {latest.time ? ` · ${latest.time}` : ''}
            {positionLabel ? ` · ${positionLabel}` : ''}
            {latest.pulse !== null ? ` · pulse ${latest.pulse}` : ''}
          </div>
          <div
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-secondary)',
              marginTop: 6,
              fontVariantNumeric: 'tabular-nums',
            }}
            title="MAP = mean arterial pressure (DBP + (SBP - DBP)/3); PP = pulse pressure (SBP - DBP)."
          >
            MAP {calculateMAP(latest.systolic, latest.diastolic)} mmHg
            {' · '}
            PP {calculatePulsePressure(latest.systolic, latest.diastolic)} mmHg
          </div>
        </div>
        <span
          style={{
            padding: '4px 10px',
            borderRadius: 'var(--v2-radius-full)',
            background: cls.color,
            color: '#FFFFFF',
            fontSize: 'var(--v2-text-xs)',
            fontWeight: 'var(--v2-weight-semibold)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--v2-tracking-wide)',
            whiteSpace: 'nowrap',
          }}
        >
          {cls.label}
        </span>
      </div>
    </Card>
  )
}
