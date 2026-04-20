import Link from 'next/link'
import { loadCycleContext } from '@/lib/cycle/load-cycle-context'
import { getCombinedCycleEntries } from '@/lib/api/nc-cycle'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { Card, EmptyState } from '@/v2/components/primitives'
import CycleCalendarGrid from '../_components/CycleCalendarGrid'
import CycleHistoryRow from '../_components/CycleHistoryRow'

export const dynamic = 'force-dynamic'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function yearAgoISO(today: string): string {
  const d = new Date(today + 'T00:00:00Z')
  d.setUTCFullYear(d.getUTCFullYear() - 1)
  return d.toISOString().slice(0, 10)
}

export default async function V2CycleHistoryPage() {
  const today = todayISO()
  const [ctx, entries] = await Promise.all([
    loadCycleContext(today),
    getCombinedCycleEntries(yearAgoISO(today), today),
  ])

  const completed = [...ctx.stats.completedCycles].reverse()
  const hasAnyData = entries.length > 0 || completed.length > 0

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
          <>
            <Card padding="md">
              <CycleCalendarGrid
                entries={entries}
                today={today}
                predictedRangeStart={ctx.periodPrediction.rangeStart}
                predictedRangeEnd={ctx.periodPrediction.rangeEnd}
              />
            </Card>

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
                log — not because the algorithm changes, but because it learns you.
              </p>
            </Card>
          </>
        )}
      </div>
    </MobileShell>
  )
}
