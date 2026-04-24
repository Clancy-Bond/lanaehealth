'use client'

/**
 * InsightCardList
 *
 * Top-N narrated correlations, each rendered as a Card with the
 * single-sentence narration and a data-source footer. The sentence
 * already honors G3 (sample size + confidence tail from the
 * narrator), so the card copy is unedited.
 *
 * Each card is also tap-to-explain: opening InsightConfidenceExplainer
 * surfaces what r/d, sample size, the freshness label, and the tier
 * actually mean. Mirrors the Oura "Sleep regularity" educational
 * pattern established by PR #45 / #46.
 */
import { useState } from 'react'
import type { InsightNarration } from '@/lib/intelligence/insight-narrator'
import { Card, EmptyState } from '@/v2/components/primitives'
import { InsightConfidenceExplainer } from './MetricExplainers'

export interface NarratedRow {
  id: string
  narration: InsightNarration
  computed_at: string
}

export interface InsightCardListProps {
  rows: NarratedRow[]
}

export default function InsightCardList({ rows }: InsightCardListProps) {
  const [openId, setOpenId] = useState<string | null>(null)

  if (rows.length === 0) {
    return (
      <EmptyState
        headline="Still learning your patterns"
        subtext="Log for 2 to 3 weeks and your first correlations will appear here. Each one comes with its own sample size and freshness label."
      />
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
      {rows.map((row) => (
        <Card key={row.id} padding="md">
          <button
            type="button"
            onClick={() => setOpenId(row.id)}
            aria-label="Open pattern details"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--v2-space-2)',
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
            <p
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-base)',
                color: 'var(--v2-text-primary)',
                lineHeight: 'var(--v2-leading-normal)',
              }}
            >
              {row.narration.sentence}
            </p>
            <div style={{ display: 'flex', gap: 'var(--v2-space-2)', flexWrap: 'wrap', alignItems: 'baseline' }}>
              {row.narration.rValueLabel && (
                <span
                  style={{
                    fontSize: 'var(--v2-text-xs)',
                    color: 'var(--v2-text-muted)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {row.narration.rValueLabel}
                </span>
              )}
              <span
                style={{
                  fontSize: 'var(--v2-text-xs)',
                  color: row.narration.isStale ? 'var(--v2-accent-warning)' : 'var(--v2-text-muted)',
                }}
              >
                {row.narration.freshnessLabel}
              </span>
              <span
                style={{
                  fontSize: 'var(--v2-text-xs)',
                  color: 'var(--v2-accent-primary)',
                  marginLeft: 'auto',
                  fontWeight: 'var(--v2-weight-medium)',
                }}
                aria-hidden="true"
              >
                What this means
              </span>
            </div>
          </button>
          {openId === row.id && (
            <InsightConfidenceExplainer
              open={true}
              onClose={() => setOpenId(null)}
              narration={row.narration}
            />
          )}
        </Card>
      ))}
    </div>
  )
}
