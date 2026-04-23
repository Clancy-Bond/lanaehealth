import Link from 'next/link'
import { loadCycleContext } from '@/lib/cycle/load-cycle-context'
import { getCombinedCycleEntries } from '@/lib/api/nc-cycle'
import { MobileShell, TopAppBar, StandardTabBar } from '@/v2/components/shell'
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

function phaseFromDay(day: number): CyclePhase {
  if (day <= 5) return 'menstrual'
  if (day <= 13) return 'follicular'
  if (day <= 16) return 'ovulatory'
  return 'luteal'
}

/**
 * Derive cycle day + phase for an arbitrary target date using the set of
 * menstruation dates pulled from combined entries. Mirrors the calendar
 * model used by computeCycleDayFromRows so tap-to-view matches the
 * Today-screen engine without introducing a second query round trip.
 */
function cycleDayFor(
  targetIso: string,
  menstruationDates: string[],
): { day: number | null; phase: CyclePhase | null } {
  if (menstruationDates.length === 0) return { day: null, phase: null }
  const targetMs = new Date(targetIso + 'T00:00:00Z').getTime()
  const eligible = menstruationDates
    .filter((d) => new Date(d + 'T00:00:00Z').getTime() <= targetMs)
    .sort()
    .reverse()
  if (eligible.length === 0) return { day: null, phase: null }

  // Walk backward through consecutive (gap <= 2 days) menstrual days to
  // find the first day of the containing period.
  let start = eligible[0]
  for (let i = 1; i < eligible.length; i++) {
    const gap =
      (new Date(eligible[i - 1] + 'T00:00:00Z').getTime() -
        new Date(eligible[i] + 'T00:00:00Z').getTime()) /
      (24 * 60 * 60 * 1000)
    if (gap <= 2) start = eligible[i]
    else break
  }

  const day = Math.floor(
    (targetMs - new Date(start + 'T00:00:00Z').getTime()) /
      (24 * 60 * 60 * 1000),
  ) + 1
  return { day, phase: phaseFromDay(day) }
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

  // Build lookup maps so the day detail sheet can render synchronously
  // when a cell is tapped. Everything here is already in memory from the
  // above queries, so this is a cheap O(n) pass.
  const entryByDate = new Map<string, CycleEntry>()
  for (const e of entries) entryByDate.set(e.date, e)

  const bbtByDate = new Map<string, BbtEntry>()
  for (const b of ctx.bbtLog.entries) bbtByDate.set(b.date, b)

  const menstruationDates = entries
    .filter((e) => e.menstruation === true)
    .map((e) => e.date)

  // Build detail rows for every date that has any signal (entry or BBT)
  // plus today. Future cells without data still open the sheet; we fill
  // them lazily with the empty-state message inside the sheet.
  const detailMap: Record<string, CycleDayDetail> = {}
  const dateSet = new Set<string>([today])
  for (const d of entryByDate.keys()) dateSet.add(d)
  for (const d of bbtByDate.keys()) dateSet.add(d)
  for (const date of dateSet) {
    const { day, phase } = cycleDayFor(date, menstruationDates)
    detailMap[date] = toDetail(
      entryByDate.get(date),
      date,
      bbtByDate.get(date),
      day,
      phase,
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
      bottom={<StandardTabBar />}
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
