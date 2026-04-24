import Link from 'next/link'
import { loadCycleContext } from '@/lib/cycle/load-cycle-context'
import { getCombinedCycleEntries } from '@/lib/api/nc-cycle'
import { pickPhaseInsight } from '@/lib/cycle/phase-insights'
import { MobileShell, TopAppBar, FAB } from '@/v2/components/shell'
import { Card, Banner, ListRow } from '@/v2/components/primitives'
import CycleRingHero from './_components/CycleRingHero'
import PeriodCountdownCard from './_components/PeriodCountdownCard'
import FertilityAwarenessCard from './_components/FertilityAwarenessCard'
import PeriodTodaySheetLauncher from './_components/PeriodTodaySheetLauncher'
import PhaseTipsCard from './_components/PhaseTipsCard'
import BbtTile from './_components/BbtTile'
import WeekdayStrip from './_components/WeekdayStrip'
import BbtChartPanel from './_components/BbtChartPanel'
import { buildBbtChartData } from './_components/bbtChartAdapter'

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
 * Phase-tinted gradient for inline explanatory cards on /v2/cycle.
 * Each phase carries a faint hue keyed to NC's phase semantics
 * (menstrual = warm, follicular = teal climb, ovulatory = mustard
 * peak, luteal = cool wind-down). Layered over --v2-bg-card so the
 * card stays in chrome and never breaks dark continuity.
 */
function phaseInsightGradient(phase: 'menstrual' | 'follicular' | 'ovulatory' | 'luteal' | 'all'): string {
  const stops: Record<typeof phase, string> = {
    menstrual:
      'linear-gradient(135deg, rgba(217, 119, 92, 0.10) 0%, rgba(232, 69, 112, 0.05) 55%, rgba(23, 23, 27, 0) 100%), var(--v2-bg-card)',
    follicular:
      'linear-gradient(135deg, rgba(77, 184, 168, 0.12) 0%, rgba(106, 207, 137, 0.05) 55%, rgba(23, 23, 27, 0) 100%), var(--v2-bg-card)',
    ovulatory:
      'linear-gradient(135deg, rgba(229, 201, 82, 0.12) 0%, rgba(240, 149, 90, 0.05) 55%, rgba(23, 23, 27, 0) 100%), var(--v2-bg-card)',
    luteal:
      'linear-gradient(135deg, rgba(155, 127, 224, 0.10) 0%, rgba(93, 173, 230, 0.05) 55%, rgba(23, 23, 27, 0) 100%), var(--v2-bg-card)',
    all:
      'linear-gradient(135deg, rgba(77, 184, 168, 0.10) 0%, rgba(155, 127, 224, 0.05) 55%, rgba(23, 23, 27, 0) 100%), var(--v2-bg-card)',
  }
  return stops[phase]
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
  // for the three days back without a second roundtrip. The strip's
  // forward cells (today + 1..3) intentionally render empty until the
  // user logs them, so we cap the read at today: nc_imported also stores
  // Natural Cycles' own predicted next-period dates, and we must not
  // surface those as if they were observed.
  const weekStart = isoOffset(today, -3)
  const [ctx, weekEntries] = await Promise.all([
    loadCycleContext(today),
    getCombinedCycleEntries(weekStart, today),
  ])
  const todaysEntry = weekEntries.find((e) => e.date === today)
  const menstruatingToday = todaysEntry?.menstruation === true
  const insight = pickPhaseInsight(ctx.current.phase, today)
  const latestBbt = ctx.bbtLog.entries[ctx.bbtLog.entries.length - 1] ?? null

  // Build the compact BBT chart for embedding directly under the
  // FertilityAwarenessCard. Period dates from the week-window entries
  // light up the period band underneath the curve. The chart only shows
  // this cycle's readings, so first-cycle users see a sparse curve that
  // grows as they log; that is the honest shape per NC's "1-3 cycle
  // learning period" framing.
  const periodDatesThisCycle = new Set(
    weekEntries.filter((e) => e.menstruation === true).map((e) => e.date),
  )
  const bbtChartData = buildBbtChartData({
    readings: ctx.bbtReadings,
    lastPeriodStart: ctx.current.lastPeriodStart,
    periodDates: periodDatesThisCycle,
  })

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
            lastPeriodISO={ctx.current.lastPeriodStart}
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

        {/* Explanatory voice block.
            Renders in chrome palette (dark + tinted gradient) per
            CLAUDE.md: NC cream/blush/sage is reserved for educational
            modals, onboarding, and printable doctor summaries. Pattern
            mirrors PrimaryInsightCard from PR #42 (frame_0200). */}
        <div
          style={{
            position: 'relative',
            borderRadius: 'var(--v2-radius-lg)',
            border: '1px solid var(--v2-border-subtle)',
            padding: 'var(--v2-space-4)',
            overflow: 'hidden',
            background:
              'linear-gradient(135deg, rgba(77, 184, 168, 0.10) 0%, rgba(155, 127, 224, 0.05) 55%, rgba(23, 23, 27, 0) 100%), var(--v2-bg-card)',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              lineHeight: 'var(--v2-leading-relaxed)',
              color: 'var(--v2-text-secondary)',
            }}
          >
            This is where you are in your cycle today. Numbers here are for orientation,
            not judgment, the goal is understanding your rhythm.
          </p>
        </div>

        {/* Predictions pair */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--v2-space-3)' }}>
          <PeriodCountdownCard prediction={ctx.periodPrediction} />
          <FertilityAwarenessCard
            prediction={ctx.fertilePrediction}
            cycleDay={ctx.current.day}
            phase={ctx.current.phase}
            isUnusuallyLong={ctx.current.isUnusuallyLong}
            confirmedOvulation={ctx.confirmedOvulation}
            ncFertilityColor={ctx.ncFertilityColorToday}
            ncOvulationStatus={ctx.ncOvulationStatusToday}
            ovulation={ctx.ovulation}
          />
        </div>

        {/* Embedded BBT chart (compact 160px). NC parity, frame_0117:
            placing the temperature curve directly under awareness keeps
            the "show your work" loop tight, the reader sees the verdict
            and the data that supports it without leaving the screen. */}
        <BbtChartPanel
          readings={bbtChartData.readings}
          coverLine={bbtChartData.coverLine}
          shiftDetected={ctx.confirmedOvulation || ctx.ovulation.bbtShiftDetected}
          compact
        />

        {/* BBT today reading */}
        <BbtTile date={today} latest={latestBbt} confirmedOvulation={ctx.confirmedOvulation} />

        {/* Phase insight (rotates daily).
            Chrome palette + phase-tinted gradient. Each phase gets a
            subtly different hue so the rotating insights feel keyed to
            where she is in the cycle without breaking dark continuity. */}
        {insight && (
          <div
            style={{
              position: 'relative',
              borderRadius: 'var(--v2-radius-lg)',
              border: '1px solid var(--v2-border-subtle)',
              padding: 'var(--v2-space-4)',
              overflow: 'hidden',
              background: phaseInsightGradient(insight.phase),
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
              <span
                style={{
                  fontSize: 'var(--v2-text-xs)',
                  textTransform: 'uppercase',
                  letterSpacing: 'var(--v2-tracking-wide)',
                  color: 'var(--v2-text-muted)',
                  fontWeight: 'var(--v2-weight-medium)',
                }}
              >
                {insight.phase === 'all' ? 'For today' : `${insight.phase} phase`}
              </span>
              <h2
                style={{
                  margin: 0,
                  fontSize: 'var(--v2-text-lg)',
                  fontWeight: 'var(--v2-weight-semibold)',
                  color: 'var(--v2-text-primary)',
                  letterSpacing: 'var(--v2-tracking-tight)',
                }}
              >
                {insight.title}
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: 'var(--v2-text-sm)',
                  lineHeight: 'var(--v2-leading-relaxed)',
                  color: 'var(--v2-text-secondary)',
                }}
              >
                {insight.body}
              </p>
            </div>
          </div>
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
