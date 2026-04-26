/*
 * /v2/cycle/insights
 *
 * NC's Cycle Insights surface (frame_0263 style summary plus the
 * deeper landscape chart in frame_0117). Wave 3 implementation:
 *
 *   A. CycleInsightsChart: landscape-style BBT view with phase color
 *      bands, prior-cycle overlay, dotted cover-line reference, and
 *      tap-to-snapshot per data point.
 *   B. MultiCycleCompare: side-by-side last 3-6 cycles with cycle
 *      length, period length, ovulation day, and anomaly chips.
 *   C. StatisticsRollup: user mean +/- SD vs published population
 *      reference ranges with sources cited inline.
 *   D. SymptomRadarCard: detected symptom-to-phase patterns from
 *      the symptom-radar module.
 *
 * Also retains the existing "you vs all cyclers" InsightRow strip
 * underneath, so existing reference-range coverage is preserved.
 *
 * Sources cited: Bull et al. 2019 NPJ Digital Medicine, Lenton et al.
 * 1984 BJOG, Bauman 1981 Fertility & Sterility, Wilcox et al. 1995
 * NEJM. Full reference table at
 * docs/research/cycle-population-references.md.
 */
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { loadCycleContext } from '@/lib/cycle/load-cycle-context'
import { computeCycleInsightsFromStats } from '@/lib/cycle/cycle-insights'
import { detectAnovulatoryCycle, fuseOvulationSignal } from '@/lib/cycle/signal-fusion'
import {
  detectSymptomCyclePatterns,
  type CycleData,
  type SymptomLog,
} from '@/lib/cycle/symptom-radar'
import { getCombinedCycleEntries } from '@/lib/api/nc-cycle'
import { createServiceClient } from '@/lib/supabase'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { Card } from '@/v2/components/primitives'
import RouteFade from '../../_components/RouteFade'
import InsightRow from './_components/InsightRow'
import CycleInsightsChart, {
  type InsightsBbtPoint,
} from './_components/CycleInsightsChart'
import MultiCycleCompare, {
  type CycleCompareEntry,
} from './_components/MultiCycleCompare'
import StatisticsRollup from './_components/StatisticsRollup'
import SymptomRadarCard from './_components/SymptomRadarCard'

export const dynamic = 'force-dynamic'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function isoDiffDays(a: string, b: string): number {
  return Math.floor(
    (Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) /
      (24 * 60 * 60 * 1000),
  )
}

function cToF(c: number): number {
  return c * (9 / 5) + 32
}

const DEVIATION_ANCHOR_F = 97.8

export default async function CycleInsightsPage() {
  const today = todayISO()
  const ctx = await loadCycleContext(today)

  // ── Per-cycle ovulation / luteal / follicular derivation ────────
  // For each completed cycle, run signal-fusion against the BBT/LH
  // restricted to that cycle's window. This is more work than the
  // current cycle alone but the dataset is small enough (12-month
  // window).
  const completed = ctx.stats.completedCycles
  const periodStarts = completed.map((c) => c.startDate)
  const lutealLengths: number[] = []
  const follicularLengths: number[] = []
  const compareEntries: CycleCompareEntry[] = []
  const reversed = [...completed].reverse() // most-recent first

  for (let i = 0; i < reversed.length; i++) {
    const c = reversed[i]
    const startIdxInOriginal = completed.indexOf(c)
    const nextStart = completed[startIdxInOriginal + 1]?.startDate ?? null
    const periodEnd = nextStart
      ? new Date(Date.parse(nextStart + 'T00:00:00Z') - 86_400_000).toISOString().slice(0, 10)
      : today
    const cycleBbt = ctx.bbtReadings.filter(
      (r) => r.date >= c.startDate && r.date <= periodEnd,
    )
    const cycleFusion = fuseOvulationSignal({
      cycleStartIso: c.startDate,
      bbt: cycleBbt,
      lhTests: [],
      ncRows: [],
      meanCycleLength: ctx.stats.meanCycleLength,
    })
    const ovulationDay = cycleFusion.ovulationDate
      ? isoDiffDays(cycleFusion.ovulationDate, c.startDate) + 1
      : null
    if (ovulationDay != null && c.lengthDays != null) {
      const luteal = c.lengthDays - ovulationDay
      if (luteal > 0 && luteal < 30) lutealLengths.push(luteal)
      if (ovulationDay > 0 && ovulationDay < 30) follicularLengths.push(ovulationDay - 1)
    }
    const anovulatory = detectAnovulatoryCycle(
      c.startDate,
      periodEnd,
      ctx.bbtReadings,
      ctx.coverLine.baseline,
    )
    compareEntries.push({
      cycle: c,
      cycleNumber: i + 1,
      ovulationDay,
      anovulatory,
    })
  }

  // ── Wave 3 InsightRow strip continues to use the cycle-insights lib ──
  const insights = computeCycleInsightsFromStats(ctx.stats, {
    lutealLengths,
    follicularLengths,
  })

  // ── Build chart data (current + prior cycle) ───────────────────
  const currentStart = ctx.stats.currentCycle?.startDate ?? null
  const priorCycle = completed.length > 0 ? completed[completed.length - 1] : null
  const priorStart = priorCycle?.startDate ?? null
  const priorEnd = currentStart
    ? new Date(Date.parse(currentStart + 'T00:00:00Z') - 86_400_000).toISOString().slice(0, 10)
    : null

  // Pull entries we need for cervical mucus + LH per day in the snapshot.
  const yearAgo = new Date(Date.parse(today + 'T00:00:00Z') - 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
  const entries = await getCombinedCycleEntries(yearAgo, today)
  const entryByDate = new Map(entries.map((e) => [e.date, e]))

  const currentChartPoints: InsightsBbtPoint[] = currentStart
    ? ctx.bbtReadings
        .filter((r) => r.date >= currentStart && r.date <= today)
        .map((r) => {
          const e = entryByDate.get(r.date)
          const temp_f =
            r.kind === 'absolute' ? cToF(r.value) : DEVIATION_ANCHOR_F + r.value * (9 / 5)
          return {
            cycleDay: isoDiffDays(r.date, currentStart) + 1,
            temp_f: Number(temp_f.toFixed(2)),
            date: r.date,
            isPeriodDay: e?.menstruation === true,
            lhPositive: (e?.lh_test_result ?? '').toLowerCase() === 'positive',
            cervicalMucus: e?.cervical_mucus_consistency ?? null,
          }
        })
    : []

  const priorChartPoints: InsightsBbtPoint[] = priorStart && priorEnd
    ? ctx.bbtReadings
        .filter((r) => r.date >= priorStart && r.date <= priorEnd)
        .map((r) => {
          const temp_f =
            r.kind === 'absolute' ? cToF(r.value) : DEVIATION_ANCHOR_F + r.value * (9 / 5)
          return {
            cycleDay: isoDiffDays(r.date, priorStart) + 1,
            temp_f: Number(temp_f.toFixed(2)),
            date: r.date,
          }
        })
    : []

  // ── Symptom radar inputs ───────────────────────────────────────
  // cycle_entries.symptoms is a string[] per day. Symptoms table is the
  // legacy categorized log; for the radar we use the per-day chips
  // because they map to the NC log surface.
  const symptomLogs: SymptomLog[] = []
  for (const e of entries) {
    if (Array.isArray(e.symptoms)) {
      for (const s of e.symptoms) {
        if (typeof s === 'string' && s.trim()) {
          symptomLogs.push({ date: e.date, symptom: s })
        }
      }
    }
  }

  // Pull legacy symptoms table too, joined to daily_logs for the date.
  const sb = createServiceClient()
  const { data: legacySymptoms } = await sb
    .from('symptoms')
    .select('symptom, logged_at')
    .gte('logged_at', yearAgo)
  for (const row of (legacySymptoms ?? []) as Array<{
    symptom: string | null
    logged_at: string | null
  }>) {
    if (!row.symptom || !row.logged_at) continue
    const date = row.logged_at.slice(0, 10)
    symptomLogs.push({ date, symptom: row.symptom })
  }

  const radarCycles: CycleData[] = compareEntries
    .filter((e) => e.cycle.lengthDays != null)
    .map((e) => ({
      startDate: e.cycle.startDate,
      lengthDays: e.cycle.lengthDays as number,
    }))
  // Include the in-progress current cycle so today-ish symptom logs
  // get classified.
  if (ctx.stats.currentCycle && ctx.stats.currentCycle.lengthDays == null) {
    radarCycles.push({
      startDate: ctx.stats.currentCycle.startDate,
      lengthDays: Math.max(1, isoDiffDays(today, ctx.stats.currentCycle.startDate) + 1),
    })
  }
  const symptomPatterns = detectSymptomCyclePatterns({
    symptomLogs,
    cycles: radarCycles,
  })

  // ── Cover line: convert to Fahrenheit for chart display ─────────
  const coverLineF = (() => {
    if (ctx.coverLine.baseline == null || ctx.coverLine.kind == null) return null
    if (ctx.coverLine.kind === 'absolute') return Number(cToF(ctx.coverLine.baseline).toFixed(2))
    return Number((DEVIATION_ANCHOR_F + ctx.coverLine.baseline * (9 / 5)).toFixed(2))
  })()

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="Cycle insights"
          leading={
            <Link
              href="/v2/cycle"
              aria-label="Back to cycle"
              style={{
                color: 'var(--v2-text-secondary)',
                textDecoration: 'none',
                padding: 'var(--v2-space-2)',
                minHeight: 'var(--v2-touch-target-min)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <ChevronLeft size={20} />
              Cycle
            </Link>
          }
        />
      }
    >
      <RouteFade>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-4)',
            padding: 'var(--v2-space-4)',
            paddingBottom: 'var(--v2-space-8)',
          }}
        >
          <Card padding="md">
            <p
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-secondary)',
                lineHeight: 'var(--v2-leading-relaxed)',
              }}
            >
              How your numbers compare to large population studies. Numbers
              here are for orientation, not judgment, the goal is
              understanding your rhythm.
            </p>
            <p
              style={{
                margin: 'var(--v2-space-2) 0 0',
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-text-muted)',
              }}
            >
              {ctx.stats.sampleSize > 0
                ? `${ctx.stats.sampleSize} completed ${ctx.stats.sampleSize === 1 ? 'cycle' : 'cycles'} on file.`
                : 'No completed cycles yet, comparisons fill in as your history grows.'}
            </p>
          </Card>

          {/* Feature A: landscape BBT chart with phase bands + prior overlay */}
          <Card padding="md" data-testid="card-chart">
            <h2
              style={{
                margin: '0 0 var(--v2-space-3)',
                fontSize: 'var(--v2-text-md)',
                fontWeight: 'var(--v2-weight-semibold)',
                color: 'var(--v2-text-primary)',
              }}
            >
              Temperature pattern
            </h2>
            <CycleInsightsChart
              current={currentChartPoints}
              prior={priorChartPoints}
              coverLine={coverLineF}
              meanCycleLength={ctx.stats.meanCycleLength}
            />
          </Card>

          {/* Feature B: side-by-side comparison of last 3-6 cycles */}
          <Card padding="md" data-testid="card-multi-cycle">
            <h2
              style={{
                margin: '0 0 var(--v2-space-3)',
                fontSize: 'var(--v2-text-md)',
                fontWeight: 'var(--v2-weight-semibold)',
                color: 'var(--v2-text-primary)',
              }}
            >
              Recent cycles side by side
            </h2>
            <MultiCycleCompare
              entries={compareEntries}
              meanCycleLength={ctx.stats.meanCycleLength}
              sdCycleLength={ctx.stats.sdCycleLength}
              meanPeriodLength={ctx.stats.meanPeriodLength}
            />
          </Card>

          {/* Feature C: statistics rollup with population reference ranges */}
          <Card padding="md" data-testid="card-rollup">
            <StatisticsRollup
              stats={ctx.stats}
              lutealLengths={lutealLengths}
              follicularLengths={follicularLengths}
            />
          </Card>

          {/* Feature D: symptom radar */}
          <Card padding="md" data-testid="card-radar">
            <SymptomRadarCard patterns={symptomPatterns} />
          </Card>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--v2-space-3)',
            }}
          >
            {insights.map((insight) => (
              <InsightRow key={insight.metric} insight={insight} />
            ))}
          </div>

          <Card padding="md" variant="explanatory">
            <h3
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-md)',
                fontWeight: 'var(--v2-weight-semibold)',
              }}
            >
              Sources
            </h3>
            <ul
              style={{
                margin: 'var(--v2-space-2) 0 0',
                paddingLeft: 'var(--v2-space-4)',
                fontSize: 'var(--v2-text-sm)',
                lineHeight: 'var(--v2-leading-relaxed)',
              }}
            >
              <li>
                Bull JR et al., NPJ Digital Medicine, 2019. n = 124,648 women,
                612,613 cycles. Cycle length and period length reference.
              </li>
              <li>
                Lenton EA et al., BJOG, 1984. Luteal n = 60, follicular n = 65.
                Phase length references.
              </li>
              <li>
                Wilcox AJ et al., NEJM, 1995. Fertile window definition, n = 221.
              </li>
              <li>
                Bauman JE, Fertility &amp; Sterility 1981. BBT shift magnitude
                guidance, augmented by NC published help center.
              </li>
            </ul>
            <p
              style={{
                margin: 'var(--v2-space-2) 0 0',
                fontSize: 'var(--v2-text-xs)',
                opacity: 0.75,
              }}
            >
              Full reference detail in
              docs/research/cycle-population-references.md.
            </p>
          </Card>
        </div>
      </RouteFade>
    </MobileShell>
  )
}
