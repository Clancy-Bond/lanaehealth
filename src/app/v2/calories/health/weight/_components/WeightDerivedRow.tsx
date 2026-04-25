'use client'

/*
 * WeightDerivedRow
 *
 * BMI badge + "more metrics" link rendered under the trend sparkline.
 * Tap on BMI opens an explainer modal; tap "More" routes to the full
 * /v2/calories/health/composition surface.
 */
import { useState } from 'react'
import Link from 'next/link'
import { Card } from '@/v2/components/primitives'
import ExplainerSheet from '../../../../_components/ExplainerSheet'

export interface WeightDerivedRowProps {
  bmi: number
  category: string
}

export default function WeightDerivedRow({ bmi, category }: WeightDerivedRowProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Card padding="md">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--v2-space-3)',
          }}
        >
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--v2-space-1)',
              textAlign: 'left',
              padding: 'var(--v2-space-2)',
              background: 'transparent',
              border: 'none',
              color: 'var(--v2-text-primary)',
              cursor: 'pointer',
              minHeight: 'var(--v2-touch-target-min)',
            }}
            aria-label="Explain BMI"
          >
            <span
              style={{
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--v2-tracking-wide)',
              }}
            >
              BMI
            </span>
            <span
              style={{
                fontSize: 'var(--v2-text-2xl)',
                fontWeight: 600,
              }}
            >
              {bmi.toFixed(1)}
            </span>
            <span
              style={{
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-secondary)',
              }}
            >
              {category}
            </span>
          </button>

          <Link
            href="/v2/calories/health/composition"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: 'var(--v2-space-3) var(--v2-space-4)',
              borderRadius: 'var(--v2-radius-full)',
              background: 'var(--v2-bg-card)',
              border: '1px solid var(--v2-border-subtle)',
              color: 'var(--v2-text-primary)',
              fontSize: 'var(--v2-text-sm)',
              textDecoration: 'none',
              minHeight: 'var(--v2-touch-target-min)',
            }}
          >
            More metrics ›
          </Link>
        </div>
      </Card>

      <ExplainerSheet
        open={open}
        onClose={() => setOpen(false)}
        title="BMI"
        bands={[
          { label: 'Underweight', min: 14, max: 18.5, color: '#5DADE6' },
          { label: 'Normal', min: 18.5, max: 25, color: '#6ACF89' },
          { label: 'Overweight', min: 25, max: 30, color: '#E5C952' },
          { label: 'Obese', min: 30, max: 45, color: '#D9775C' },
        ]}
        currentValue={bmi}
        currentBandLabel={category}
        source="World Health Organization, Technical Report Series 894 (2000). See docs/research/comprehensive-body-metrics.md."
      >
        <p>
          BMI compares weight to height squared. WHO uses 18.5 to 24.9 as the
          normal band. It cannot tell muscle apart from fat, so athletes
          can land in &quot;overweight&quot; with low body fat. Read it
          alongside body fat and waist measures on the body composition
          page, never alone.
        </p>
      </ExplainerSheet>
    </>
  )
}
