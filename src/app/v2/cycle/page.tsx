import Link from 'next/link'
import { loadCycleContext } from '@/lib/cycle/load-cycle-context'
import { getCombinedCycleEntries } from '@/lib/api/nc-cycle'
import { pickPhaseInsight } from '@/lib/cycle/phase-insights'
import { MobileShell, TopAppBar, FAB, StandardTabBar } from '@/v2/components/shell'
import { Card, Banner, ListRow } from '@/v2/components/primitives'
import CycleRingHero from './_components/CycleRingHero'
import PeriodCountdownCard from './_components/PeriodCountdownCard'
import FertilityAwarenessCard from './_components/FertilityAwarenessCard'
import PeriodTodaySheetLauncher from './_components/PeriodTodaySheetLauncher'
import PhaseTipsCard from './_components/PhaseTipsCard'
import BbtTile from './_components/BbtTile'
import WeekdayStrip from './_components/WeekdayStrip'

export const dynamic = 'force-dynamic'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function isoOffset(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/*
 * LEARNING-MODE HOOK G1: Today-screen signal priority.
 *
 * The order of cards below shapes the whole section's feel.
 *
 *   Option A (ring-first, Oura):  hero ring is the first thing the eye
 *     finds. Brand-forward. Risks feeling cold if data is sparse.
 *
 *   Option B (prompt-first, NC):  ask "Did your period start today?"
 *     above the ring. Catches missed logs early; every downstream number
 *     depends on accurate period-start data.
 *
 * Default below: hero ring, then the period prompt directly beneath. This
 * hybrid keeps the brand moment while surfacing the input that starves
 * predictions when skipped. Swap the two <section> blocks (ring + prompt)
 * to go full prompt-first.
 */

export default async function V2CyclePage() {
  const today = todayISO()
  // Pull a week-wide window so the WeekdayStrip can render checkmarks
  // for the three days back without a second roundtrip.
  const weekStart = isoOffset(today, -3)
  const weekEnd = isoOffset(today, 3)
  const [ctx, weekEntries] = await Promise.all([
    loadCycleContext(today),
    getCombinedCycleEntries(weekStart, weekEnd),
  ])
  const todaysEntry = weekEntries.find((e) => e.date === today)
  const menstruatingToday = todaysEntry?.menstruation === true
  const insight = pickPhaseInsight(ctx.current.phase, today)
  const latestBbt = ctx.bbtLog.entries[ctx.bbtLog.entries.length - 1] ?? null

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="Today"
          trailing={
            <Link
              href="/v2/cycle/history"
              aria-label="Cycle history"
              style={{
                color: 'var(--v2-text-secondary)',
                fontSize: 'var(--v2-text-sm)',
                padding: 'var(--v2-space-2)',
                textDecoration: 'none',
                minHeight: 'var(--v2-touch-target-min)',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              History
            </Link>
          }
        />
      }
      fab={
        <Link href="/v2/cycle/log" aria-label="Log cycle entry" style={{ textDecoration: 'none' }}>
          <FAB label="Log cycle entry" variant="floating" />
        </Link>
      }
      bottom={<StandardTabBar />}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-5)',
          padding: 'var(--v2-space-4)',
          paddingBottom: 'var(--v2-space-8)',
        }}
      >
        {/* Hero ring */}
        <section style={{ paddingTop: 'var(--v2-space-4)', paddingBottom: 'var(--v2-space-2)' }}>
          <CycleRingHero
            day={ctx.current.day}
            phase={ctx.current.phase}
            isUnusuallyLong={ctx.current.isUnusuallyLong}
            meanCycleLength={ctx.stats.meanCycleLength}
          />
        </section>

        {/* Weekday strip (NC parity, frame_0008): three days back, today
            centered, three ahead, checkmarks on logged days. */}
        <WeekdayStrip today={today} entries={weekEntries} />

        {/* Phase-specific tips (NC parity) */}
        <PhaseTipsCard phase={ctx.current.phase} />

        {/* Period prompt: feeds every downstream prediction */}
        <Card padding="sm">
          <PeriodTodaySheetLauncher date={today} initialMenstruating={menstruatingToday} />
        </Card>

        {/* Explanatory voice block */}
        <Card variant="explanatory" padding="md">
          <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', lineHeight: 'var(--v2-leading-relaxed)' }}>
            This is where you are in your cycle today. Numbers here are for orientation,
            not judgment, the goal is understanding your rhythm.
          </p>
        </Card>

        {/* Predictions pair */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--v2-space-3)' }}>
          <PeriodCountdownCard prediction={ctx.periodPrediction} />
          <FertilityAwarenessCard
            prediction={ctx.fertilePrediction}
            cycleDay={ctx.current.day}
            phase={ctx.current.phase}
            isUnusuallyLong={ctx.current.isUnusuallyLong}
            confirmedOvulation={ctx.confirmedOvulation}
          />
        </div>

        {/* BBT */}
        <BbtTile date={today} latest={latestBbt} confirmedOvulation={ctx.confirmedOvulation} />

        {/* Phase insight (rotates daily) */}
        {insight && (
          <Card variant="explanatory" padding="md">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
              <span
                style={{
                  fontSize: 'var(--v2-text-xs)',
                  textTransform: 'uppercase',
                  letterSpacing: 'var(--v2-tracking-wide)',
                  color: 'var(--v2-surface-explanatory-muted)',
                }}
              >
                {insight.phase === 'all' ? 'For today' : `${insight.phase} phase`}
              </span>
              <h2 style={{ margin: 0, fontSize: 'var(--v2-text-lg)', fontWeight: 'var(--v2-weight-semibold)' }}>
                {insight.title}
              </h2>
              <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', lineHeight: 'var(--v2-leading-relaxed)' }}>
                {insight.body}
              </p>
            </div>
          </Card>
        )}

        {/* Deeper insights link */}
        <Card padding="none">
          <Link
            href="/v2/topics/cycle"
            aria-label="See cycle insights"
            style={{
              display: 'block',
              textDecoration: 'none',
              color: 'inherit',
              padding: 'var(--v2-space-3) var(--v2-space-4)',
              minHeight: 'var(--v2-touch-target-min)',
            }}
          >
            <ListRow
              label="See cycle insights"
              subtext="Phase details, hormone log, and cycle length patterns."
              chevron
              divider={false}
            />
          </Link>
        </Card>

        {/* Contraceptive scope disclaimer */}
        <Banner
          intent="info"
          title="Awareness, not contraception"
          body="LanaeHealth tracks patterns for understanding. It is not an FDA-cleared contraceptive."
        />
      </div>
    </MobileShell>
  )
}
