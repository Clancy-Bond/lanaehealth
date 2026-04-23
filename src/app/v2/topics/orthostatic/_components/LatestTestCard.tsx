/*
 * LatestTestCard
 *
 * Shows the most recent orthostatic test: a color-coded classification
 * pill, three big-number stats (peak rise / resting HR / standing HR at
 * 10 min), and any symptoms noted during the test. The big-value +
 * small-label pattern mirrors Oura frame_0001.
 *
 * When no test is on file, the parent skips rendering.
 */
import { format, parseISO } from 'date-fns'
import { Card } from '@/v2/components/primitives'
import type { ClassifiedTest } from '@/lib/intelligence/orthostatic'

export interface LatestTestCardProps {
  latest: ClassifiedTest | null
}

interface ClassificationStyle {
  label: string
  background: string
  color: string
}

const CLASSIFICATION_STYLES: Record<
  ClassifiedTest['classification'],
  ClassificationStyle
> = {
  positive: {
    label: 'Positive',
    background: 'var(--v2-accent-warning)',
    color: 'var(--v2-bg-primary)',
  },
  borderline: {
    label: 'Borderline',
    background: 'var(--v2-accent-highlight)',
    color: 'var(--v2-bg-primary)',
  },
  negative: {
    label: 'Negative',
    background: 'var(--v2-accent-success)',
    color: 'var(--v2-bg-primary)',
  },
  incomplete: {
    label: 'Incomplete',
    background: 'var(--v2-border-strong)',
    color: 'var(--v2-text-primary)',
  },
}

interface StatProps {
  label: string
  value: number | null
  unit: string
}

function Stat({ label, value, unit }: StatProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-1)',
      }}
    >
      <span
        style={{
          fontSize: 'var(--v2-text-2xl)',
          fontWeight: 'var(--v2-weight-bold)',
          color: 'var(--v2-text-primary)',
          lineHeight: 1,
          letterSpacing: 'var(--v2-tracking-tight)',
        }}
      >
        {value ?? '-'}
      </span>
      <span
        style={{
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--v2-tracking-wide)',
        }}
      >
        {label}
        {value !== null && (
          <span style={{ textTransform: 'none', letterSpacing: 0 }}> {unit}</span>
        )}
      </span>
    </div>
  )
}

export default function LatestTestCard({ latest }: LatestTestCardProps) {
  if (!latest) return null

  const style = CLASSIFICATION_STYLES[latest.classification]
  const dateLabel = format(parseISO(latest.test_date + 'T00:00:00'), 'MMM d, yyyy')

  return (
    <Card padding="md">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-4)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-1)' }}>
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--v2-tracking-wide)',
            }}
          >
            Latest test
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--v2-space-3)',
              flexWrap: 'wrap',
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-lg)',
                fontWeight: 'var(--v2-weight-semibold)',
                color: 'var(--v2-text-primary)',
              }}
            >
              {dateLabel}
            </h2>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 10px',
                borderRadius: 'var(--v2-radius-full)',
                background: style.background,
                color: style.color,
                fontSize: 'var(--v2-text-xs)',
                fontWeight: 'var(--v2-weight-semibold)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--v2-tracking-wide)',
              }}
            >
              {style.label}
            </span>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 'var(--v2-space-3)',
          }}
        >
          <Stat label="Peak rise" value={latest.peak_rise_bpm} unit="bpm" />
          <Stat label="Resting HR" value={latest.resting_hr_bpm} unit="bpm" />
          <Stat
            label="At 10 min"
            value={latest.standing_hr_10min}
            unit="bpm"
          />
        </div>

        {latest.symptoms_experienced && (
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            Symptoms noted: {latest.symptoms_experienced}
          </p>
        )}
      </div>
    </Card>
  )
}
