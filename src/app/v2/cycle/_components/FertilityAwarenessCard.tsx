'use client'

import { useState } from 'react'
import { Card } from '@/v2/components/primitives'
import type { FertileWindowPrediction } from '@/lib/cycle/period-prediction'
import type { CyclePhase } from '@/lib/types'
import { classifyFertileWindow } from '@/lib/cycle/fertile-window'
import type { FusionResult } from '@/lib/cycle/signal-fusion'
import { FertileWindowExplainer } from './MetricExplainers'

function formatRange(start: string | null, end: string | null): string {
  if (!start || !end) return ''
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const sameMonth = s.getMonth() === e.getMonth()
  const fmt = (d: Date, short: boolean) =>
    d.toLocaleDateString('en-US', short ? { day: 'numeric' } : { month: 'short', day: 'numeric' })
  return sameMonth ? `${fmt(s, false)} to ${fmt(e, true)}` : `${fmt(s, false)} to ${fmt(e, false)}`
}

export interface FertilityAwarenessCardProps {
  prediction: FertileWindowPrediction
  cycleDay: number | null
  phase: CyclePhase | null
  isUnusuallyLong: boolean
  confirmedOvulation: boolean
  /** NC's own verdict for today, when present in imported history. */
  ncFertilityColor?: 'GREEN' | 'RED' | null
  /**
   * NC's own ovulation_status for today. When 'OVU_CONFIRMED', renders a
   * "Verified by Natural Cycles" badge so the reader knows the verdict
   * traces back to NC's FDA-cleared algorithm rather than a recomputation.
   */
  ncOvulationStatus?: 'OVU_CONFIRMED' | 'OVU_PREDICTION' | 'OVU_NOT_CONFIRMED' | null
  /** Fused ovulation signal, used when NC verdict is absent. */
  ovulation?: FusionResult | null
}

export default function FertilityAwarenessCard({
  prediction,
  cycleDay,
  phase,
  isUnusuallyLong,
  confirmedOvulation,
  ncFertilityColor = null,
  ncOvulationStatus = null,
  ovulation = null,
}: FertilityAwarenessCardProps) {
  const [explainerOpen, setExplainerOpen] = useState(false)
  const signal = classifyFertileWindow({
    cycleDay,
    phase,
    isUnusuallyLong,
    confirmedOvulation,
    ncFertilityColor,
    ovulation,
  })
  const rangeText = formatRange(prediction.rangeStart, prediction.rangeEnd)

  // NC-style binary: green (not fertile) vs red (fertile / use protection).
  // No yellow tier per NC's published algorithm constraints.
  const dotColor =
    signal.status === 'green' ? 'var(--v2-accent-success)' : 'var(--v2-surface-explanatory-accent)'

  // Show NC attribution when NC's own data was the basis for today's
  // verdict. Two cases qualify: NC stamped a fertility_color for today,
  // OR NC has confirmed ovulation in this cycle (which means signal-fusion
  // also leaned on NC's confirmed date). Confirmed wins over predicted.
  const ncAttribution: 'confirmed' | 'verdict' | null =
    ncOvulationStatus === 'OVU_CONFIRMED'
      ? 'confirmed'
      : ncFertilityColor != null
        ? 'verdict'
        : null

  return (
    <Card padding="md">
      <button
        type="button"
        aria-label="Open fertile window explainer"
        onClick={() => setExplainerOpen(true)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-2)',
          background: 'transparent',
          border: 'none',
          padding: 0,
          margin: 0,
          width: '100%',
          textAlign: 'left',
          cursor: 'pointer',
          color: 'inherit',
          font: 'inherit',
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
          Awareness
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--v2-space-2)' }}>
          <span
            aria-hidden
            style={{
              width: 10,
              height: 10,
              borderRadius: 'var(--v2-radius-full)',
              background: dotColor,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 'var(--v2-text-lg)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
            }}
          >
            {signal.label}
          </span>
        </div>
        {rangeText && prediction.status !== 'unknown' && (
          <span style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)' }}>
            Window: {rangeText}
          </span>
        )}
        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-muted)',
            lineHeight: 'var(--v2-leading-normal)',
          }}
        >
          {signal.detail}
        </p>
        {ncAttribution && (
          <span
            aria-label={
              ncAttribution === 'confirmed'
                ? 'Ovulation confirmed by Natural Cycles'
                : 'Verdict provided by Natural Cycles'
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--v2-space-1)',
              alignSelf: 'flex-start',
              marginTop: 'var(--v2-space-1)',
              padding: '2px 8px',
              borderRadius: 'var(--v2-radius-full)',
              border: '1px solid var(--v2-border-subtle)',
              background: 'rgba(108, 207, 137, 0.08)',
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-secondary)',
              fontWeight: 'var(--v2-weight-medium)',
              lineHeight: 1.3,
            }}
          >
            <span aria-hidden style={{ color: 'var(--v2-accent-success)' }}>
              {'\u2713'}
            </span>
            {ncAttribution === 'confirmed'
              ? 'Ovulation confirmed by Natural Cycles'
              : 'Verified by Natural Cycles'}
          </span>
        )}
        <p
          style={{
            margin: 0,
            marginTop: 'var(--v2-space-1)',
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-muted)',
            fontStyle: 'italic',
          }}
        >
          Awareness, not contraception.
        </p>
      </button>
      <FertileWindowExplainer
        open={explainerOpen}
        onClose={() => setExplainerOpen(false)}
        status={signal.status}
        rangeStart={prediction.rangeStart}
        rangeEnd={prediction.rangeEnd}
        confirmedOvulation={confirmedOvulation}
      />
    </Card>
  )
}
