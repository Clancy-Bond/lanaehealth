import { Card } from '@/v2/components/primitives'
import DoctorPanelHeader from './DoctorPanelHeader'
import type { CompletenessReport } from '@/lib/doctor/completeness'

interface CompletenessFooterCardProps {
  report: CompletenessReport
}

/*
 * CompletenessFooterCard
 *
 * Bottom-of-brief data-quality footnote. Tells the doctor how much of
 * the 30-day window is actually backed by data. A doctor looking at a
 * clean trend chart should still know whether it's "14 of 30 days
 * logged" or "29 of 30 logged." That changes how much weight the
 * pattern carries.
 */
export default function CompletenessFooterCard({ report }: CompletenessFooterCardProps) {
  const { windowDays, dailyLogs, ouraDays, cycleDays, warnings } = report
  const bars = [
    { label: 'Daily logs', pct: dailyLogs.coveragePct, total: dailyLogs.total },
    { label: 'Oura sync', pct: ouraDays.coveragePct, total: ouraDays.total },
    { label: 'Cycle days', pct: cycleDays.coveragePct, total: cycleDays.total },
  ]
  const lowest = Math.min(...bars.map((b) => b.pct))
  const summary =
    lowest >= 80
      ? `Strong ${windowDays}-day data coverage`
      : lowest >= 50
        ? `Partial ${windowDays}-day coverage; some gaps`
        : `Sparse ${windowDays}-day coverage; interpret with care`

  return (
    <Card padding="md">
      <DoctorPanelHeader title="Data completeness" summary={summary} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
        {bars.map((b) => (
          <div key={b.label}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-secondary)',
                marginBottom: 4,
              }}
            >
              <span>{b.label}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {b.total} / {windowDays} days · {b.pct}%
              </span>
            </div>
            <div
              style={{
                height: 4,
                borderRadius: 999,
                background: 'var(--v2-bg-elevated)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, Math.max(0, b.pct))}%`,
                  height: '100%',
                  background:
                    b.pct >= 80
                      ? 'var(--v2-accent-success)'
                      : b.pct >= 50
                        ? 'var(--v2-accent-highlight)'
                        : 'var(--v2-accent-warning)',
                }}
              />
            </div>
          </div>
        ))}
      </div>
      {warnings.length > 0 && (
        <ul
          style={{
            margin: 'var(--v2-space-3) 0 0 0',
            padding: 0,
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {warnings.map((w, i) => (
            <li key={i} style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)' }}>
              · {w}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
