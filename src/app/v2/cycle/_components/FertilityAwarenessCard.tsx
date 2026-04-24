'use client'

import { useState } from 'react'
import { Card } from '@/v2/components/primitives'
import type { FertileWindowPrediction } from '@/lib/cycle/period-prediction'
import type { CyclePhase } from '@/lib/types'
import { classifyFertileWindow } from '@/lib/cycle/fertile-window'
import { FertileWindowExplainer } from './MetricExplainers'

function formatRange(start: string | null, end: string | null): string {
  if (!start || !end) return ''
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const sameMonth = s.getMonth() === e.getMonth()
  const fmt = (d: Date, short: boolean) =>
    d.toLocaleDateString('en-US', short ? { day: 'numeric' } : { month: 'short', day: 'numeric' })
  return sameMonth ? `${fmt(s, false)}–${fmt(e, true)}` : `${fmt(s, false)} – ${fmt(e, false)}`
}

export interface FertilityAwarenessCardProps {
  prediction: FertileWindowPrediction
  cycleDay: number | null
  phase: CyclePhase | null
  isUnusuallyLong: boolean
  confirmedOvulation: boolean
}

export default function FertilityAwarenessCard({
  prediction,
  cycleDay,
  phase,
  isUnusuallyLong,
  confirmedOvulation,
}: FertilityAwarenessCardProps) {
  const [explainerOpen, setExplainerOpen] = useState(false)
  const signal = classifyFertileWindow({ cycleDay, phase, isUnusuallyLong, confirmedOvulation })
  const rangeText = formatRange(prediction.rangeStart, prediction.rangeEnd)

  const dotColor =
    signal.status === 'green'
      ? 'var(--v2-accent-success)'
      : signal.status === 'red'
        ? 'var(--v2-surface-explanatory-accent)'
        : 'var(--v2-accent-highlight)'

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
