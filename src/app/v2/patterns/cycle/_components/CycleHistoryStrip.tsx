/**
 * CycleHistoryStrip
 *
 * Horizontal bar chart of the last 6 completed cycle lengths with a
 * dotted line at the user's mean. A quick visual answer to "am I
 * consistent lately?" without a paragraph of explanation.
 */
import type { Cycle } from '@/lib/cycle/cycle-stats'
import { Card } from '@/v2/components/primitives'

export interface CycleHistoryStripProps {
  cycles: Cycle[]
  meanLength: number | null
}

export default function CycleHistoryStrip({ cycles, meanLength }: CycleHistoryStripProps) {
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

  return (
    <Card padding="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
        <div>
          <span
            style={{
              fontSize: 'var(--v2-text-2xl)',
              fontWeight: 'var(--v2-weight-bold)',
              color: 'var(--v2-text-primary)',
              letterSpacing: 'var(--v2-tracking-tight)',
              lineHeight: 1.1,
            }}
          >
            {meanLength ? meanLength.toFixed(1) : '--'}
          </span>
          <span style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-muted)', marginLeft: 'var(--v2-space-2)' }}>
            day average
          </span>
        </div>

        <div role="img" aria-label="Last cycles lengths" style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--v2-space-2)', minHeight: 90 }}>
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
                    background: isOutlier ? 'var(--v2-accent-warning)' : 'var(--v2-surface-explanatory-accent)',
                    borderRadius: 'var(--v2-radius-sm)',
                  }}
                />
              </div>
            )
          })}
        </div>

        <p style={{ margin: 0, fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)', lineHeight: 'var(--v2-leading-normal)' }}>
          {last.length === 6
            ? 'Your last 6 cycle lengths. Bars outside your usual range are shown in warning color.'
            : `Your last ${last.length} completed cycle${last.length === 1 ? '' : 's'}.`}
        </p>
      </div>
    </Card>
  )
}
