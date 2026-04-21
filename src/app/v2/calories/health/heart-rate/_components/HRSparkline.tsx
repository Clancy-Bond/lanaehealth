'use client'

/*
 * HRSparkline
 *
 * Wraps HealthSparkline with HR-specific chart config. Single teal
 * line, auto-padded y-domain with a 5-bpm pad so a user's narrow
 * range (say 70-85) still reads as a visible trend rather than a
 * flat line on a 50-200 canvas. Spot-check context varies row by
 * row (resting vs. standing vs. post-meal), so the line intentionally
 * plots the raw bpm : meaning comes from the tooltip + the recent
 * list below.
 *
 * TODO(lanae): consider a two-series chart splitting resting vs.
 * standing once enough standing points accumulate : the standing
 * delta is the POTS-load-bearing signal. Leaving single-series for
 * Session 05 because the context mix is currently sparse.
 */
import { format, parseISO } from 'date-fns'
import HealthSparkline, {
  type HealthSparklinePoint,
} from '@/app/v2/_tail-shared/HealthSparkline'
import type { HeartRateEntry } from '@/lib/calories/heart-rate'

// --v2-accent-primary. Recharts writes stroke/fill as SVG presentation
// attributes where CSS custom properties are not resolved; literal hex
// mirrors the v2 tokens.
const COLOR_LINE = '#4DB8A8'

export interface HRSparklineProps {
  entries: HeartRateEntry[]
}

export default function HRSparkline({ entries }: HRSparklineProps) {
  // Take the most recent 30 (entries arrive newest-first from the
  // loader), then flip to oldest-first so the line reads left to
  // right as "over time".
  const window = entries.slice(0, 30).slice().reverse()

  if (window.length < 2) return null

  const data: HealthSparklinePoint[] = window.map((e) => ({
    date: e.date,
    label: format(parseISO(e.date + 'T00:00:00'), 'MMM d'),
    bpm: e.bpm,
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
        series={[{ key: 'bpm', color: COLOR_LINE, label: 'bpm' }]}
        autoPad={5}
        unit="bpm"
      />
    </div>
  )
}
