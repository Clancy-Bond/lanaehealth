'use client'

/**
 * CycleHistoryStrip
 *
 * Horizontal bar chart of the last 6 completed cycle lengths with a
 * hairline reference at the user's mean. A quick visual answer to
 * "am I consistent lately?" without a paragraph of explanation.
 *
 * Header is tap-to-explain: opening CycleHistoryExplainer walks
 * through what the average is, what the warning color means, and how
 * a cycle is bounded. Mirrors the Oura Sleep regularity educational
 * pattern from PR #45 / #46.
 */
import { useState } from 'react'
import type { Cycle } from '@/lib/cycle/cycle-stats'
import { Card } from '@/v2/components/primitives'
import { CycleHistoryExplainer } from '../../_components/MetricExplainers'

export interface CycleHistoryStripProps {
  cycles: Cycle[]
  meanLength: number | null
}

export default function CycleHistoryStrip({ cycles, meanLength }: CycleHistoryStripProps) {
  const [open, setOpen] = useState(false)
  const last = cycles.slice(-6)
  if (last.length === 0) {
    return (
      <Card padding="md">
        <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-muted)' }}>
          Your cycle history will appear here after you log two completed cycles.
        </p>
      </Card>
    )
  }
  const lengths = last.map((c) => c.lengthDays ?? 0).filter((n) => n > 0)
  const max = Math.max(...lengths, meanLength ?? 0, 35)
  const meanPct = meanLength != null ? (meanLength / max) * 80 : null

  return (
    <Card padding="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open cycle history explainer"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            background: 'transparent',
            border: 'none',
            padding: 0,
            margin: 0,
            cursor: 'pointer',
            color: 'inherit',
            textAlign: 'left',
            font: 'inherit',
            width: '100%',
          }}
        >
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--v2-tracking-wide)',
              fontWeight: 'var(--v2-weight-medium)',
            }}
          >
            Average cycle length
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--v2-space-2)' }}>
            <span
              style={{
                fontSize: 'var(--v2-text-3xl)',
                fontWeight: 'var(--v2-weight-medium)',
                color: 'var(--v2-text-primary)',
                letterSpacing: 'var(--v2-tracking-tight)',
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {meanLength ? meanLength.toFixed(1) : '--'}
            </span>
            <span style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-muted)' }}>
              days, last {last.length}
            </span>
          </div>
        </button>

        <div style={{ position: 'relative', minHeight: 90 }}>
          {meanPct !== null && (
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: meanPct,
                height: 1,
                background: 'var(--v2-border-subtle)',
                zIndex: 1,
              }}
            />
          )}
          <div
            role="img"
            aria-label={`Last ${last.length} cycle lengths${meanLength ? `, mean ${meanLength.toFixed(1)} days` : ''}`}
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 'var(--v2-space-2)',
              minHeight: 90,
              position: 'relative',
              zIndex: 2,
            }}
          >
            {last.map((c, i) => {
              const height = c.lengthDays ? (c.lengthDays / max) * 80 : 2
              const isOutlier = meanLength != null && c.lengthDays != null && Math.abs(c.lengthDays - meanLength) > 5
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {c.lengthDays ?? '--'}
                  </span>
                  <div
                    title={`${c.startDate}: ${c.lengthDays ?? 'in progress'}`}
                    style={{
                      width: '100%',
                      height,
                      background: isOutlier
                        ? 'var(--v2-accent-warning)'
                        : 'var(--v2-surface-explanatory-accent)',
                      borderRadius: 'var(--v2-radius-sm)',
                      opacity: isOutlier ? 0.85 : 0.9,
                    }}
                  />
                </div>
              )
            })}
          </div>
        </div>

        <p style={{ margin: 0, fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)', lineHeight: 'var(--v2-leading-normal)' }}>
          {last.length === 6
            ? 'Hairline marks your average. Bars more than 5 days off use a warning color.'
            : `Your last ${last.length} completed cycle${last.length === 1 ? '' : 's'}.`}
        </p>
      </div>

      <CycleHistoryExplainer
        open={open}
        onClose={() => setOpen(false)}
        meanLength={meanLength}
        cycleCount={last.length}
      />
    </Card>
  )
}
