/**
 * /cycle/history - monthly calendar + cycle list.
 *
 * The calendar re-uses the home `CalendarHeatmap` so the UX matches what
 * users see on the dashboard. The cycle list below shows completed
 * cycles with lengths, mean/SD, and flags for out-of-range cycles.
 */
import { format, subDays } from 'date-fns'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase'
import { CalendarHeatmap } from '@/components/home/CalendarHeatmap'
import { CycleHistoryList } from '@/components/cycle/CycleHistoryList'
import { computeCycleStats } from '@/lib/cycle/cycle-stats'

export const dynamic = 'force-dynamic'

export default async function CycleHistoryPage() {
  const sb = createServiceClient()
  const today = new Date()
  const todayISO = format(today, 'yyyy-MM-dd')
  const yearAgoISO = format(subDays(today, 365), 'yyyy-MM-dd')
  const monthAgoStart = format(new Date(today.getFullYear(), today.getMonth() - 2, 1), 'yyyy-MM-dd')

  const [dailyResult, cycleResult, ouraResult, ncResult] = await Promise.all([
    sb
      .from('daily_logs')
      .select('date, overall_pain')
      .gte('date', monthAgoStart)
      .lte('date', todayISO)
      .order('date', { ascending: true }),
    sb
      .from('cycle_entries')
      .select('date, menstruation')
      .gte('date', yearAgoISO)
      .lte('date', todayISO)
      .order('date', { ascending: true }),
    sb
      .from('oura_daily')
      .select('date, sleep_score, hrv_avg, resting_hr')
      .gte('date', monthAgoStart)
      .lte('date', todayISO)
      .order('date', { ascending: true }),
    sb
      .from('nc_imported')
      .select('date, menstruation, flow_quantity')
      .gte('date', yearAgoISO)
      .lte('date', todayISO)
      .order('date', { ascending: true }),
  ])

  const cycleEntries = (cycleResult.data ?? []) as Array<{ date: string; menstruation: boolean | null }>
  const ncImported = (ncResult.data ?? []) as Array<{
    date: string
    menstruation: string | null
    flow_quantity: string | null
  }>

  const stats = computeCycleStats({ cycleEntries, ncImported })

  // Calendar heatmap expects `menstruation: boolean`. Union cycle_entries and
  // nc_imported so the dots reflect the true union used by every other
  // cycle surface. We coerce nulls to false.
  const ncMenstrualDays = new Set(
    ncImported
      .filter((n) => n.menstruation === 'MENSTRUATION' || (n.flow_quantity != null && n.menstruation !== 'SPOTTING'))
      .map((n) => n.date),
  )
  const mergedCalendarEntries = Array.from(
    new Map(
      [
        ...cycleEntries.map((c) => [c.date, { date: c.date, menstruation: c.menstruation === true }] as const),
        ...Array.from(ncMenstrualDays).map((d) => [d, { date: d, menstruation: true }] as const),
      ],
    ).values(),
  )

  const dailyLogs = (dailyResult.data ?? []).map((d: { date: string; overall_pain: number | null }) => ({
    date: d.date,
    overall_pain: d.overall_pain,
  }))
  const ouraEntries = (ouraResult.data ?? []) as Array<{
    date: string
    sleep_score: number | null
    hrv_avg: number | null
    resting_hr: number | null
  }>

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        padding: 16,
        maxWidth: 820,
        margin: '0 auto',
        paddingBottom: 96,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Cycle / History
        </span>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, lineHeight: 1.15 }}>
          Calendar + past cycles
        </h1>
      </div>

      <CalendarHeatmap
        dailyLogs={dailyLogs}
        cycleEntries={mergedCalendarEntries}
        ouraEntries={ouraEntries}
        initialMonth={format(today, 'yyyy-MM')}
      />

      <CycleHistoryList stats={stats} />

      <Link
        href="/cycle"
        style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          textDecoration: 'none',
          alignSelf: 'flex-start',
        }}
      >
        &lsaquo; Back to Cycle
      </Link>
    </div>
  )
}
