/**
 * SleepNightList
 *
 * Last 14 nights as list rows. Each row is tappable to expand into
 * a per-night detail route (not yet built; placeholder href). The
 * sparkline bar on the right gives a sense of scale at a glance.
 */
import { Card, ListRow } from '@/v2/components/primitives'
import type { OuraDaily } from '@/lib/types'
import { bandConfig, bandForScore, secondsToHoursMinutes } from '@/lib/v2/home-signals'

export interface SleepNightListProps {
  nights: OuraDaily[]
}

export default function SleepNightList({ nights }: SleepNightListProps) {
  if (nights.length === 0) {
    return (
      <Card padding="md">
        <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-muted)' }}>
          No nights yet. Once your Oura ring syncs, your last two weeks of sleep
          will appear here.
        </p>
      </Card>
    )
  }
  const sorted = [...nights].sort((a, b) => b.date.localeCompare(a.date))
  return (
    <Card padding="none">
      <div style={{ padding: 'var(--v2-space-4) var(--v2-space-4) 0' }}>
        <span
          style={{
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--v2-tracking-wide)',
            fontWeight: 'var(--v2-weight-medium)',
          }}
        >
          Last {sorted.length} nights
        </span>
      </div>
      <div style={{ padding: '0 var(--v2-space-4) var(--v2-space-2)' }}>
        {sorted.map((n, i) => {
          const color = n.sleep_score != null ? bandConfig(bandForScore(n.sleep_score)).color : 'var(--v2-text-muted)'
          return (
            <ListRow
              key={n.date}
              label={formatNightLabel(n.date)}
              subtext={secondsToHoursMinutes(n.sleep_duration)}
              trailing={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--v2-space-2)' }}>
                  <span style={{ fontSize: 'var(--v2-text-base)', color, fontWeight: 'var(--v2-weight-semibold)' }}>
                    {n.sleep_score ?? '--'}
                  </span>
                </span>
              }
              divider={i < sorted.length - 1}
            />
          )
        })}
      </div>
    </Card>
  )
}

function formatNightLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
