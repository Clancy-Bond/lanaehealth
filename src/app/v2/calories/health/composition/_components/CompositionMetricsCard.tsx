'use client'

/*
 * CompositionMetricsCard
 *
 * Reads computed metrics from props (page-level math) and renders a
 * tappable list of derived values: BMI, body fat (Navy or stored),
 * WHR, WHtR, LBM, fat mass. Each row opens a dedicated explainer
 * modal with bands + plain-language meaning. Reuses the
 * ExplainerSheet pattern from PR #45/46.
 */
import { useState } from 'react'
import { Card } from '@/v2/components/primitives'
import ExplainerSheet from '../../../../_components/ExplainerSheet'

export interface ComputedMetric {
  key: string
  label: string
  value: string
  category?: string
  /** Plain-language explanation for the modal. */
  explanation: string
  /** Citation source line. */
  source: string
  /** Optional band data for the explainer. */
  bands?: Array<{ label: string; min: number; max: number; color: string }>
  /** Numeric value for tick on band bar; omit for non-banded metrics. */
  numericValue?: number | null
  /** Short band label (e.g. "Healthy", "Increased risk"). */
  currentBandLabel?: string
}

export default function CompositionMetricsCard({
  metrics,
}: {
  metrics: ComputedMetric[]
}) {
  const [openKey, setOpenKey] = useState<string | null>(null)

  if (metrics.length === 0) {
    return null
  }

  return (
    <Card padding="md">
      <h2
        style={{
          margin: 0,
          marginBottom: 'var(--v2-space-3)',
          fontSize: 'var(--v2-text-base)',
          color: 'var(--v2-text-primary)',
        }}
      >
        Derived metrics
      </h2>
      <p
        style={{
          margin: 0,
          marginBottom: 'var(--v2-space-3)',
          color: 'var(--v2-text-muted)',
          fontSize: 'var(--v2-text-sm)',
        }}
      >
        Tap any row to learn what it means.
      </p>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-2)',
        }}
      >
        {metrics.map((m) => (
          <button
            key={m.key}
            onClick={() => setOpenKey(m.key)}
            type="button"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 'var(--v2-space-3)',
              borderRadius: 'var(--v2-radius-md)',
              background: 'var(--v2-bg-card)',
              border: '1px solid var(--v2-border-subtle)',
              color: 'var(--v2-text-primary)',
              cursor: 'pointer',
              textAlign: 'left',
              minHeight: 'var(--v2-touch-target-min)',
            }}
            aria-label={`Explain ${m.label}`}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-1)' }}>
              <span style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-muted)' }}>
                {m.label}
              </span>
              {m.category && (
                <span
                  style={{
                    fontSize: 'var(--v2-text-xs)',
                    color: 'var(--v2-text-secondary)',
                  }}
                >
                  {m.category}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--v2-space-2)' }}>
              <span style={{ fontSize: 'var(--v2-text-base)', fontWeight: 600 }}>
                {m.value}
              </span>
              <span aria-hidden style={{ color: 'var(--v2-text-muted)' }}>
                {'›'}
              </span>
            </div>
          </button>
        ))}
      </div>

      {metrics.map((m) => (
        <ExplainerSheet
          key={`sheet-${m.key}`}
          open={openKey === m.key}
          onClose={() => setOpenKey(null)}
          title={m.label}
          bands={m.bands}
          currentValue={m.numericValue ?? undefined}
          currentBandLabel={m.currentBandLabel}
          source={m.source}
        >
          <p>{m.explanation}</p>
        </ExplainerSheet>
      ))}
    </Card>
  )
}
