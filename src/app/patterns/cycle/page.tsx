/**
 * /patterns/cycle - cycle-length trend + symptom-by-phase heatmap.
 *
 * Aggregated view: NC's Cycle Insights (pattern 14) plus the endo-specific
 * phase symptom correlation (Bearable / Flo hybrid). We reuse the
 * cycle-stats + phase-symptoms helpers so one data pull powers both charts.
 */
import { format, subDays } from 'date-fns'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase'
import { computeCycleStats, mergeMenstrualDays, groupIntoPeriods } from '@/lib/cycle/cycle-stats'
import { aggregatePhaseSymptoms } from '@/lib/cycle/phase-symptoms'
import { CycleLengthChart } from '@/components/cycle/CycleLengthChart'
import { PhaseSymptomHeatmap } from '@/components/cycle/PhaseSymptomHeatmap'
import { CycleHistoryList } from '@/components/cycle/CycleHistoryList'

export const dynamic = 'force-dynamic'

export default async function PatternsCyclePage() {
  const sb = createServiceClient()
  const today = new Date()
  const todayISO = format(today, 'yyyy-MM-dd')
  const oneYearAgo = format(subDays(today, 365), 'yyyy-MM-dd')

  const [cycleResult, ncResult, dailyResult] = await Promise.all([
    sb
      .from('cycle_entries')
      .select('date, menstruation')
      .gte('date', oneYearAgo)
      .lte('date', todayISO)
      .order('date', { ascending: true }),
    sb
      .from('nc_imported')
      .select('date, menstruation, flow_quantity')
      .gte('date', oneYearAgo)
      .lte('date', todayISO)
      .order('date', { ascending: true }),
    sb
      .from('daily_logs')
      .select('date, overall_pain, fatigue, bloating, stress, sleep_quality')
      .gte('date', oneYearAgo)
      .lte('date', todayISO)
      .order('date', { ascending: true }),
  ])

  const cycleEntries = (cycleResult.data ?? []) as Array<{ date: string; menstruation: boolean | null }>
  const ncImported = (ncResult.data ?? []) as Array<{
    date: string
    menstruation: string | null
    flow_quantity: string | null
  }>
  const dailyRows = (dailyResult.data ?? []) as Array<{
    date: string
    overall_pain: number | null
    fatigue: number | null
    bloating: number | null
    stress: number | null
    sleep_quality: number | null
  }>

  const stats = computeCycleStats({ cycleEntries, ncImported })
  const periods = groupIntoPeriods(mergeMenstrualDays({ cycleEntries, ncImported }))
  const periodStarts = periods.map((p) => p.start)
  const phaseCounts = aggregatePhaseSymptoms(dailyRows, periodStarts)

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
          Patterns / Cycle
        </span>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, lineHeight: 1.15 }}>
          Cycle-length trend &amp; symptoms by phase
        </h1>
      </div>

      <section
        className="card"
        style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Cycle length over time</div>
          <div className="tabular" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {stats.sampleSize} complete
          </div>
        </div>
        <CycleLengthChart cycles={stats.completedCycles} meanCycleLength={stats.meanCycleLength} />
      </section>

      <PhaseSymptomHeatmap counts={phaseCounts} />

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
