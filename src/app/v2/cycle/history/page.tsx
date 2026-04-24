import Link from 'next/link'
import { loadCycleContext } from '@/lib/cycle/load-cycle-context'
import { computeCycleDayFromRows } from '@/lib/cycle/current-day'
import { detectAnovulatoryCycle } from '@/lib/cycle/signal-fusion'
import { getCombinedCycleEntries } from '@/lib/api/nc-cycle'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { Card, EmptyState } from '@/v2/components/primitives'
import CycleHistoryRow from '../_components/CycleHistoryRow'
import type { CyclePhase, CycleEntry } from '@/lib/types'
import type { BbtEntry } from '@/lib/cycle/bbt-log'
import type { CycleDayDetail } from '../_components/CycleDayDetailSheet'
import CycleHistoryClient from './_components/CycleHistoryClient'

export const dynamic = 'force-dynamic'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function yearAgoISO(today: string): string {
  const d = new Date(today + 'T00:00:00Z')
  d.setUTCFullYear(d.getUTCFullYear() - 1)
  return d.toISOString().slice(0, 10)
}

function toDetail(
  entry: CycleEntry | undefined,
  date: string,
  bbt: BbtEntry | undefined,
  day: number | null,
  phase: CyclePhase | null,
): CycleDayDetail {
  return {
    date,
    flow_level: entry?.flow_level ?? null,
    menstruation: entry?.menstruation ?? false,
    ovulation_signs: entry?.ovulation_signs ?? null,
    lh_test_result: entry?.lh_test_result ?? null,
    cervical_mucus_consistency: entry?.cervical_mucus_consistency ?? null,
    cervical_mucus_quantity: entry?.cervical_mucus_quantity ?? null,
    symptoms: entry?.symptoms ?? null,
    temp_f: bbt?.temp_f ?? null,
    temp_c: bbt?.temp_c ?? null,
    notes: entry?.endo_notes ?? null,
    cycleDay: day,
    phase,
  }
}

export default async function V2CycleHistoryPage() {
  const today = todayISO()
  const [ctx, entries] = await Promise.all([
    loadCycleContext(today),
    getCombinedCycleEntries(yearAgoISO(today), today),
  ])

  const completed = [...ctx.stats.completedCycles].reverse()
  const hasAnyData = entries.length > 0 || completed.length > 0

  // Score each completed cycle for anovulation. detectAnovulatoryCycle is
  // pure, so this is cheap; the alternative would be storing a per-cycle
  // flag in the database which doesn't exist yet.
  //
  // periodEnd is the day BEFORE the next cycle's CD1, so we look at the
  // ovulatory window of the cycle in question without bleeding into the
  // next cycle's BBT readings. The most recent cycle (index 0 of
  // `completed` after reverse) excludes the in-progress cycle.
  const periodStarts = ctx.stats.completedCycles.map((c) => c.startDate)
  const anovulatoryByStart = new Map<string, boolean>()
  for (let i = 0; i < ctx.stats.completedCycles.length; i++) {
    const c = ctx.stats.completedCycles[i]
    const nextStart = periodStarts[i + 1] ?? null
    const periodEnd = nextStart
      ? new Date(Date.parse(nextStart + 'T00:00:00Z') - 86_400_000).toISOString().slice(0, 10)
      : today
    anovulatoryByStart.set(
      c.startDate,
      detectAnovulatoryCycle(c.startDate, periodEnd, ctx.bbtReadings, ctx.coverLine.baseline),
    )
  }

  // Build lookup maps so the day detail sheet can render synchronously
  // when a cell is tapped. Everything here is already in memory from the
  // above queries, so this is a cheap O(n) pass.
  const entryByDate = new Map<string, CycleEntry>()
  for (const e of entries) entryByDate.set(e.date, e)

  const bbtByDate = new Map<string, BbtEntry>()
  for (const b of ctx.bbtLog.entries) bbtByDate.set(b.date, b)

  // Shape entries into the row-shape that computeCycleDayFromRows expects.
  // We reuse the one authoritative helper rather than re-implementing the
  // consecutive-days walk here, so tap-to-view uses exactly the same
  // cycle-day + phase the Today screen shows.
  const cycleEntriesForHelper = entries.map((e) => ({
    date: e.date,
    menstruation: e.menstruation === true,
  }))

  // Build detail rows for every date that has any signal (entry or BBT)
  // plus today. Future cells without data still open the sheet; we fill
  // them lazily with the empty-state message inside the sheet.
  const detailMap: Record<string, CycleDayDetail> = {}
  const dateSet = new Set<string>([today])
  for (const d of entryByDate.keys()) dateSet.add(d)
  for (const d of bbtByDate.keys()) dateSet.add(d)
  for (const date of dateSet) {
    const current = computeCycleDayFromRows(
      date,
      cycleEntriesForHelper,
      [],
      ctx.stats.meanCycleLength,
    )
    detailMap[date] = toDetail(
      entryByDate.get(date),
      date,
      bbtByDate.get(date),
      current.day,
      current.phase,
    )
  }

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="History"
          leading={
            <Link
              href="/v2/cycle"
              aria-label="Back to cycle"
              style={{
                color: 'var(--v2-text-secondary)',
                fontSize: 'var(--v2-text-base)',
                padding: 'var(--v2-space-2)',
                textDecoration: 'none',
                minHeight: 'var(--v2-touch-target-min)',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              ‹
            </Link>
          }
        />
      }
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-4)',
          padding: 'var(--v2-space-4)',
          paddingBottom: 'var(--v2-space-8)',
        }}
      >
        {!hasAnyData ? (
          <EmptyState
            headline="No cycles logged yet"
            subtext="Your first few cycles teach the app how your body actually works. Until then, trust your body more than the ranges here."
            cta={
              <Link
                href="/v2/cycle/log"
                style={{
                  color: 'var(--v2-accent-primary)',
                  fontWeight: 'var(--v2-weight-semibold)',
                  textDecoration: 'none',
                }}
              >
                Log today &rsaquo;
              </Link>
            }
          />
        ) : (
          <CycleHistoryClient
            today={today}
            entries={entries}
            predictedRangeStart={ctx.periodPrediction.rangeStart}
            predictedRangeEnd={ctx.periodPrediction.rangeEnd}
            detailMap={detailMap}
          >
            <Card padding="md">
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--v2-space-3)' }}>
                <h2 style={{ margin: 0, fontSize: 'var(--v2-text-lg)', fontWeight: 'var(--v2-weight-semibold)' }}>
                  Completed cycles
                </h2>
                {ctx.stats.meanCycleLength != null && (
                  <span style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    avg {ctx.stats.meanCycleLength}d
                    {ctx.stats.sdCycleLength != null && ` ± ${ctx.stats.sdCycleLength}d`}
                  </span>
                )}
              </div>
              {completed.length === 0 ? (
                <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-muted)', lineHeight: 'var(--v2-leading-relaxed)' }}>
                  Your current cycle is still in progress. Completed cycles show up here once a new period starts.
                </p>
              ) : (
                <div>
                  {completed.map((c, i) => (
                    <CycleHistoryRow
                      key={`${c.startDate}-${i}`}
                      cycle={c}
                      meanCycleLength={ctx.stats.meanCycleLength}
                      anovulatory={anovulatoryByStart.get(c.startDate) === true}
                    />
                  ))}
                </div>
              )}
            </Card>

            <Card variant="explanatory" padding="md">
              <h3 style={{ margin: 0, fontSize: 'var(--v2-text-base)', fontWeight: 'var(--v2-weight-semibold)' }}>
                Why 3+ cycles matter
              </h3>
              <p
                style={{
                  margin: 0,
                  marginTop: 'var(--v2-space-2)',
                  fontSize: 'var(--v2-text-sm)',
                  lineHeight: 'var(--v2-leading-relaxed)',
                }}
              >
                One cycle is a snapshot. Three or more is a pattern. Your range tightens as you
                log, not because the algorithm changes, but because it learns you.
              </p>
            </Card>
          </CycleHistoryClient>
        )}
      </div>
    </MobileShell>
  )
}
