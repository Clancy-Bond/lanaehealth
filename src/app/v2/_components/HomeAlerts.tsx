/**
 * HomeAlerts
 *
 * Renders zero, one, or two Banner primitives based on live state:
 *
 *   - Upcoming appointment within the next 7 days (info)
 *   - Cycle running unusually long (warning), surfaced from the
 *     same rule used on the cycle page so the two agree.
 *
 * Alerts here are opt-in for the reader's attention. If nothing is
 * worth surfacing, we render nothing rather than padding with
 * placeholders. A silent home on a good day is a feature.
 */
import { Banner } from '@/v2/components/primitives'
import type { HomeContext } from '@/lib/v2/load-home-context'

export interface HomeAlertsProps {
  ctx: HomeContext
}

function daysBetween(a: string, b: string): number {
  const t1 = new Date(a + 'T00:00:00Z').getTime()
  const t2 = new Date(b + 'T00:00:00Z').getTime()
  return Math.floor((t2 - t1) / 86_400_000)
}

export default function HomeAlerts({ ctx }: HomeAlertsProps) {
  const alerts: Array<{ key: string; node: React.ReactNode }> = []

  if (ctx.nextAppointment) {
    const days = daysBetween(ctx.today, ctx.nextAppointment.date)
    if (days >= 0 && days <= 7) {
      const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`
      alerts.push({
        key: 'appt',
        node: (
          <Banner
            intent="info"
            title={`Appointment ${when}`}
            body={`${ctx.nextAppointment.doctor_name ?? 'Your doctor'}${ctx.nextAppointment.specialty ? `, ${ctx.nextAppointment.specialty}` : ''}. A quick pre-visit log tends to make the visit more useful.`}
          />
        ),
      })
    }
  }

  if (ctx.cycle?.current?.isUnusuallyLong) {
    alerts.push({
      key: 'cycle-long',
      node: (
        <Banner
          intent="warning"
          title="Cycle running long"
          body={`Day ${ctx.cycle.current.day}. If a period started and was not logged, the cycle view is the place to fix that.`}
        />
      ),
    })
  }

  if (alerts.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
      {alerts.map((a) => (
        <div key={a.key}>{a.node}</div>
      ))}
    </div>
  )
}
