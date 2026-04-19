/**
 * Home widget: cycle day + phase ring.
 *
 * RSC wrapper around CycleTodayRing. Each home widget owns its own data
 * fetch so they can be rendered in parallel. Clicking the widget jumps
 * to /cycle so the user can see the full surface.
 */
import Link from 'next/link'
import { loadCycleContext } from '@/lib/cycle/load-cycle-context'
import { CycleTodayRing } from '@/components/cycle/CycleTodayRing'

export async function CycleTodayRingWidget({ date }: { date: string }) {
  const ctx = await loadCycleContext(date)

  return (
    <Link
      href="/cycle"
      className="press-feedback"
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <div
        className="card"
        style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Cycle today
        </div>
        <CycleTodayRing
          day={ctx.current.day}
          phase={ctx.current.phase}
          isUnusuallyLong={ctx.current.isUnusuallyLong}
          size="widget"
        />
      </div>
    </Link>
  )
}
