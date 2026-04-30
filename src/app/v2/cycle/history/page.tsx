import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { loadCycleContext } from '@/lib/cycle/load-cycle-context'
import { computeCycleDayFromRows } from '@/lib/cycle/current-day'
import { detectAnovulatoryCycle } from '@/lib/cycle/signal-fusion'
import { getCombinedCycleEntries } from '@/lib/api/nc-cycle'
import { getCurrentUser } from '@/lib/auth/get-user'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { Card, EmptyState } from '@/v2/components/primitives'
import CycleHistoryRow from '../_components/CycleHistoryRow'
import type { CyclePhase, CycleEntry } from '@/lib/types'
import type { BbtEntry } from '@/lib/cycle/bbt-log'
import type { CycleDayDetail } from '../_components/CycleDayDetailSheet'
import CycleHistoryClient from './_components/CycleHistoryClient'
import NCHistoryRail, { type NCHistoryRailGroup, type NCHistoryRailRow } from '@/v2/components/NCHistoryRail'

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
  const user = await getCurrentUser()
  const [ctx, entries] = await Promise.all([
    loadCycleContext(today, user?.id ?? null),
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

  // Build detail rows for every date that has any signal (entry, BBT,
  // or Oura BBT reading) plus today. Future cells without data still
  // open the sheet; we fill them lazily with the empty-state message
  // inside the sheet.
  const detailMap: Record<string, CycleDayDetail> = {}
  const dateSet = new Set<string>([today])
  for (const d of entryByDate.keys()) dateSet.add(d)
  for (const d of bbtByDate.keys()) dateSet.add(d)
  // Add Oura BBT-only dates too -- otherwise rows for days where the
  // only signal is the ring never appear in detailMap and never make
  // it into the rail.
  for (const r of ctx.bbtReadings) dateSet.add(r.date)
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

  // Index the unified BBT stream (Oura deviation + NC absolute +
  // manual) so the rail can show Oura's body_temp_deviation when
  // there is no manual / NC absolute reading for the date. Without
  // this the temperature pill on the rail stays blank for users
  // whose only signal is the Oura ring.
  const bbtReadingByDate = new Map<string, (typeof ctx.bbtReadings)[number]>()
  for (const r of ctx.bbtReadings) bbtReadingByDate.set(r.date, r)

  // Build NC rail groups: one per month, descending so the most-recent
  // month leads. Each row pulls cycle day + phase + temp + menstruation
  // from detailMap so the rail is a 1:1 visual of what the day-detail
  // sheet would show on tap.
  const railRowsByMonth = new Map<string, NCHistoryRailRow[]>()
  const sortedDates = [...dateSet].sort().reverse()
  for (const date of sortedDates) {
    const detail = detailMap[date]
    if (!detail) continue
    const ymKey = date.slice(0, 7)
    const month = new Date(date + 'T00:00:00Z').toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
    const existing = railRowsByMonth.get(month) ?? []
    const isMenstruation = detail.menstruation === true
    // Mark a "Cycle start" inline marker on the first day of each
    // logged period so the rail visually breaks between cycles.
    const marker = isMenstruation && (() => {
      const prevDate = sortedDates[sortedDates.indexOf(date) + 1]
      if (!prevDate) return false
      const prev = detailMap[prevDate]
      const gap =
        (Date.parse(date + 'T00:00:00Z') - Date.parse(prevDate + 'T00:00:00Z')) /
        86_400_000
      return !prev?.menstruation || gap > 2
    })()
      ? 'Cycle start'
      : null
    // Temp label: prefer the manual / NC absolute °F we already
    // mapped onto detail.temp_f. When that is missing, fall back to
    // an Oura deviation reading and format it as a "+0.18° vs base"
    // label so the user still sees a number rather than a blank pill.
    let tempLabel: string | null = null
    if (detail.temp_f != null) {
      tempLabel = `${detail.temp_f.toFixed(2)}°F`
    } else {
      const reading = bbtReadingByDate.get(date)
      if (reading && reading.kind === 'absolute' && Number.isFinite(reading.value)) {
        // Convert Celsius absolute -> Fahrenheit for display.
        const f = reading.value * 1.8 + 32
        tempLabel = `${f.toFixed(2)}°F`
      } else if (reading && reading.kind === 'deviation' && Number.isFinite(reading.value)) {
        const sign = reading.value >= 0 ? '+' : '−'
        tempLabel = `${sign}${Math.abs(reading.value).toFixed(2)}° base`
      }
    }
    existing.push({
      date,
      cycleDay: detail.cycleDay,
      phase: detail.phase,
      isMenstruation,
      isFertile: detail.phase === 'ovulatory' || detail.phase === 'follicular',
      isPredicted: date > today,
      isToday: date === today,
      tempFahrenheit: detail.temp_f,
      tempLabel,
      marker,
    })
    railRowsByMonth.set(month, existing)
  }
  const railGroups: NCHistoryRailGroup[] = [...railRowsByMonth.entries()].map(([label, rows]) => ({
    label,
    rows,
  }))

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          transparent
          title={
            <span
              style={{
                fontSize: 'var(--v2-text-xl)',
                fontWeight: 'var(--v2-weight-bold)',
                color: 'var(--v2-surface-explanatory-cta, #5B2852)',
                letterSpacing: 'var(--v2-tracking-tight)',
              }}
            >
              History
            </span>
          }
          leading={
            <Link
              href="/v2/cycle"
              aria-label="Back to cycle"
              style={{
                color: 'var(--v2-text-secondary)',
                padding: 'var(--v2-space-2)',
                textDecoration: 'none',
                minHeight: 'var(--v2-touch-target-min)',
                minWidth: 'var(--v2-touch-target-min)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChevronLeft size={22} strokeWidth={1.75} aria-hidden />
            </Link>
          }
        />
      }
    >
      <div
        className="v2-surface-explanatory"
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
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--v2-space-1)',
                }}
              >
                Log today
                <ChevronRight size={16} strokeWidth={2} aria-hidden />
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
            railGroups={railGroups}
            ovulationDates={
              // Current-cycle ovulation only for now. Per-cycle ovulation
              // for past cycles is computed in /v2/cycle/insights via
              // detectAnovulatoryCycle + fuseOvulationSignal; folding
              // that compute into the history page is a follow-up. Today
              // a Cycler at least sees their most recent ovulation
              // marked on the calendar.
              ctx.ovulation?.ovulationDate ? [ctx.ovulation.ovulationDate] : []
            }
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
                      cycleNumber={i + 1}
                      connectorBelow={i < completed.length - 1}
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
