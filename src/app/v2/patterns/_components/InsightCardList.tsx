/**
 * InsightCardList
 *
 * Top-N narrated correlations, each rendered as a Card with the
 * single-sentence narration and a data-source footer. The sentence
 * already honors G3 (sample size + confidence tail from the
 * narrator), so the card copy is unedited.
 */
import type { InsightNarration } from '@/lib/intelligence/insight-narrator'
import { Card, EmptyState } from '@/v2/components/primitives'

export interface NarratedRow {
  id: string
  narration: InsightNarration
  computed_at: string
}

export interface InsightCardListProps {
  rows: NarratedRow[]
}

export default function InsightCardList({ rows }: InsightCardListProps) {
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
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
            <div style={{ display: 'flex', gap: 'var(--v2-space-2)', flexWrap: 'wrap' }}>
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
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
