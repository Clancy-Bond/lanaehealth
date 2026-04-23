/**
 * MacroSummaryCard
 *
 * Simple totals for protein / carbs / fat across the window. Low
 * effort, high signal: every entry we have has macros if the user
 * has MyNetDiary integration or manual macros set.
 */
import type { DayTotals } from '@/lib/calories/home-data'
import { Card } from '@/v2/components/primitives'

export interface MacroSummaryCardProps {
  days: DayTotals[]
}

export default function MacroSummaryCard({ days }: MacroSummaryCardProps) {
  const logged = days.filter((d) => d.entryCount > 0)
  if (logged.length < 3) {
    return (
      <Card padding="md">
        <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-muted)' }}>
          Macro averages appear after 3 days of logged meals. You have {logged.length} so far.
        </p>
      </Card>
    )
  }

  const avg = (field: keyof Pick<DayTotals, 'protein' | 'carbs' | 'fat'>): number =>
    Math.round(logged.reduce((s, d) => s + d[field], 0) / logged.length)

  const rows = [
    { label: 'Protein', value: avg('protein'), color: 'var(--v2-accent-success)' },
    { label: 'Carbs', value: avg('carbs'), color: 'var(--v2-accent-highlight)' },
    { label: 'Fat', value: avg('fat'), color: 'var(--v2-accent-warning)' },
  ]

  return (
    <Card padding="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
        <span
          style={{
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--v2-tracking-wide)',
            fontWeight: 'var(--v2-weight-medium)',
          }}
        >
          Average macros per day
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--v2-space-2)' }}>
          {rows.map((row) => (
            <div key={row.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span
                style={{
                  fontSize: 'var(--v2-text-2xl)',
                  fontWeight: 'var(--v2-weight-bold)',
                  color: row.color,
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                {row.value}
              </span>
              <span style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)' }}>{row.label}g</span>
            </div>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)', lineHeight: 'var(--v2-leading-normal)' }}>
          Based on {logged.length} days with macro data.
        </p>
      </div>
    </Card>
  )
}
