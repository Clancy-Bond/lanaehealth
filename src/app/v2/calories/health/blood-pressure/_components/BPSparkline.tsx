'use client'

/*
 * BPSparkline
 *
 * Wraps HealthSparkline with BP-specific chart config. Two lines
 * (systolic + diastolic), hard y-domain of [50, 200] mmHg so the
 * clinical range reads the same across users and visits. Uses the
 * terracotta warning hex for systolic (the number that trends
 * "pay-attention" first in POTS) and the teal primary for diastolic.
 *
 * TODO(lanae): if Lanae's trend settles inside a narrow band and the
 * [50, 200] window makes movement hard to see, consider a per-user
 * adaptive domain (e.g. [median - 30, median + 30], clamped to
 * clinical safe range). Leaving fixed for now to keep screenshots
 * comparable across dates.
 */
import { format, parseISO } from 'date-fns'
import HealthSparkline, {
  type HealthSparklinePoint,
} from '@/app/v2/_tail-shared/HealthSparkline'
import type { BloodPressureEntry } from '@/lib/calories/blood-pressure'

// --v2-accent-warning + --v2-accent-primary. Recharts writes stroke/
// fill as SVG presentation attributes where CSS custom properties are
// not resolved; literal hex mirrors the v2 tokens.
const COLOR_SYSTOLIC = '#D9775C'
const COLOR_DIASTOLIC = '#4DB8A8'

export interface BPSparklineProps {
  entries: BloodPressureEntry[]
}

export default function BPSparkline({ entries }: BPSparklineProps) {
  // Take the most recent 30 (entries arrive newest-first from the
  // loader), then flip to oldest-first so the line reads left to right
  // as "over time".
  const window = entries.slice(0, 30).slice().reverse()

  if (window.length < 2) return null

  const data: HealthSparklinePoint[] = window.map((e) => ({
    date: e.date,
    label: format(parseISO(e.date + 'T00:00:00'), 'MMM d'),
    systolic: e.systolic,
    diastolic: e.diastolic,
  }))

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-3)',
      }}
    >
      <span
        style={{
          fontSize: 'var(--v2-text-xs)',
          fontWeight: 'var(--v2-weight-semibold)',
          color: 'var(--v2-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--v2-tracking-wide)',
        }}
      >
        Last {window.length} readings
      </span>
      <HealthSparkline
        data={data}
        series={[
          { key: 'systolic', color: COLOR_SYSTOLIC, label: 'Systolic' },
          { key: 'diastolic', color: COLOR_DIASTOLIC, label: 'Diastolic' },
        ]}
        yDomain={[50, 200]}
        unit="mmHg"
      />
    </div>
  )
}
