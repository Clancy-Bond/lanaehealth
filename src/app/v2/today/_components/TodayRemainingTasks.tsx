/**
 * TodayRemainingTasks
 *
 * Lists the check-ins that are still blank. Each row deep-links into
 * the log route at the relevant section so a tap lands on the input
 * that is one step away from being done.
 *
 * When everything is logged, the list renders a single success row
 * rather than disappearing silently: the reader gets the closing
 * satisfaction of a completed list.
 */
import Link from 'next/link'
import { Card, ListRow } from '@/v2/components/primitives'

export interface TodayRemainingTasksProps {
  missing: Array<{ key: string; label: string; subtext: string; href: string }>
}

export default function TodayRemainingTasks({ missing }: TodayRemainingTasksProps) {
  if (missing.length === 0) {
    return (
      <Card padding="md">
        <ListRow
          label="All check-ins are in for today"
          subtext="Nothing left to log. Rest easy."
          intent="success"
          divider={false}
        />
      </Card>
    )
  }
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
          Still to log
        </span>
      </div>
      <div style={{ padding: '0 var(--v2-space-4) var(--v2-space-2)' }}>
        {missing.map((m, i) => (
          <Link key={m.key} href={m.href} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
            <ListRow
              label={m.label}
              subtext={m.subtext}
              chevron
              divider={i < missing.length - 1}
            />
          </Link>
        ))}
      </div>
    </Card>
  )
}
