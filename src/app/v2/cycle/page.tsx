import Link from 'next/link'
import { Bell } from 'lucide-react'
import { loadCycleContext } from '@/lib/cycle/load-cycle-context'
import { getCombinedCycleEntries } from '@/lib/api/nc-cycle'
import { pickPhaseInsight } from '@/lib/cycle/phase-insights'
import { classifyFertileWindow } from '@/lib/cycle/fertile-window'
import { getCurrentUser } from '@/lib/auth/get-user'
import { countUnreadMessages } from '@/lib/cycle/messages-store'
import { getTutorialProgress } from '@/lib/cycle/tutorial-store'
import { MobileShell, TopAppBar, StandardTabBar, FAB } from '@/v2/components/shell'
import { Card, Banner, ListRow } from '@/v2/components/primitives'
import CycleTourLauncher from './_components/CycleTourLauncher'
import CycleRingHero from './_components/CycleRingHero'
import PeriodCountdownCard from './_components/PeriodCountdownCard'
import FertilityAwarenessCard from './_components/FertilityAwarenessCard'
import PeriodTodaySheetLauncher from './_components/PeriodTodaySheetLauncher'
import PhaseTipsCard from './_components/PhaseTipsCard'
import BbtTile from './_components/BbtTile'
import WeekdayStrip from './_components/WeekdayStrip'
import BbtChartPanel from './_components/BbtChartPanel'
import { buildBbtChartData } from './_components/bbtChartAdapter'
import RouteSlide from '../_components/RouteSlide'
import RefreshRouter from '../_components/RefreshRouter'
import CorrectionsPanel from '@/v2/components/CorrectionsPanel'
import NCPhaseCard from '@/v2/components/NCPhaseCard'
import NCSymptomChips from '@/v2/components/NCSymptomChips'
import NCPhaseInsightCard from '@/v2/components/NCPhaseInsightCard'
import NCStatsCard from '@/v2/components/NCStatsCard'

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
  const user = await getCurrentUser()
  const userId = user?.id ?? null
  const [ctx, weekEntries, unreadCount, tutorialProgress] = await Promise.all([
    loadCycleContext(today, userId),
    getCombinedCycleEntries(weekStart, today),
    user?.id ? countUnreadMessages(user.id) : Promise.resolve(0),
    user?.id ? getTutorialProgress(user.id) : Promise.resolve(null),
  ])
  const todaysEntry = weekEntries.find((e) => e.date === today)
  const menstruatingToday = todaysEntry?.menstruation === true
  const insight = pickPhaseInsight(ctx.current.phase, today)
  const latestBbt = ctx.bbtLog.entries[ctx.bbtLog.entries.length - 1] ?? null

  // Compute today's fertility verdict so the ring hero can render NC's
  // signature green/red orb with the actionable verdict as headline.
  // This is the same classifier the FertilityAwarenessCard uses below;
  // running it here costs nothing (pure function over already-loaded
  // context) and keeps both surfaces aligned to one verdict.
  const todayVerdict = classifyFertileWindow({
    cycleDay: ctx.current.day,
    phase: ctx.current.phase,
    isUnusuallyLong: ctx.current.isUnusuallyLong,
    confirmedOvulation: ctx.confirmedOvulation,
    ncFertilityColor: ctx.ncFertilityColorToday,
    ovulation: ctx.ovulation,
  })

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
          transparent
          /* NC frame_0010 top-bar: brand title centered in NC plum +
           * tiny pink superscript ° marker so the visual hierarchy
           * mirrors NC's "NC° Birth Control" header. */
          title={
            <span
              style={{
                fontSize: 'var(--v2-text-xl)',
                fontWeight: 'var(--v2-weight-bold)',
                color: 'var(--v2-surface-explanatory-cta, #5B2852)',
                letterSpacing: 'var(--v2-tracking-tight)',
              }}
            >
              Cycle
              <sup
                style={{
                  fontSize: '0.55em',
                  marginLeft: 2,
                  color: 'var(--v2-surface-explanatory-accent, #E84570)',
                  fontWeight: 'var(--v2-weight-semibold)',
                }}
              >
                °
              </sup>
            </span>
          }
          trailing={
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Link
                data-tour-step="messages-bell"
                href="/v2/cycle/messages"
                aria-label={
                  unreadCount > 0
                    ? `Messages, ${unreadCount} unread`
                    : 'Messages'
                }
                style={{
                  position: 'relative',
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
                <Bell size={20} aria-hidden />
                {unreadCount > 0 && (
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      minWidth: 16,
                      height: 16,
                      padding: '0 4px',
                      borderRadius: 'var(--v2-radius-full)',
                      background: 'var(--v2-accent-red, #E84570)',
                      color: '#fff',
                      fontSize: 10,
                      lineHeight: '16px',
                      fontWeight: 600,
                      textAlign: 'center',
                    }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              <Link
                data-tour-step="history-link"
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
            </div>
          }
        />
      }
      bottom={<StandardTabBar cycleBadgeCount={unreadCount} surface="explanatory" />}
      fab={
        <Link href="/v2/cycle/log" aria-label="Log cycle entry" style={{ textDecoration: 'none' }}>
          <FAB label="Log cycle entry" variant="floating" />
        </Link>
      }
    >
      <RefreshRouter>
        <RouteSlide>
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
        {/*
         * NC TODAY CARD (frame_0010, top-of-screen). Phase insight
         * card sits FIRST: bold headline + body paragraph + outline
         * "Full graph" pill linking into the BBT/insights view. This
         * is the first thing the reader sees when /v2/cycle opens.
         */}
        <NCPhaseInsightCard
          phase={ctx.current.phase}
          graphHref="/v2/cycle/insights"
        />

        {/*
         * NC PHASE CARD (frame_0010, second card). Replaces the
         * giant centered CycleRingHero with NC's pattern: a phase
         * headline, small ring at the top right, and an inner cream
         * block with exercise + nutrition guidance keyed to the
         * current phase. The cycle day still surfaces under the
         * headline as a small pill so the user always sees "Day N"
         * without us having to shout it in 80-pixel type.
         */}
        <div data-tour-step="today-ring">
          <NCPhaseCard
            phase={ctx.current.phase}
            trailing={
              ctx.current.day != null ? (
                <span
                  style={{
                    alignSelf: 'flex-start',
                    marginTop: 'var(--v2-space-1)',
                    fontSize: 'var(--v2-text-xs)',
                    fontWeight: 'var(--v2-weight-semibold)',
                    color: 'var(--v2-surface-explanatory-text-muted, rgba(45, 25, 60, 0.65))',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Cycle day {ctx.current.day}
                  {todayVerdict.label ? ` · ${todayVerdict.label}` : ''}
                </span>
              ) : null
            }
          />
        </div>

        {/* Weekday strip (NC parity, frame_0008): three days back, today
            centered, three ahead, checkmarks on logged days. */}
        <WeekdayStrip today={today} entries={weekEntries} />

        {/* NC symptom + mood chip strip (frame_0010, bottom). Tapping a
            chip routes to /v2/cycle/log?symptom=<slug> with the chip
            pre-selected. */}
        <div data-tour-step="phase-chip">
          <NCSymptomChips phase={ctx.current.phase} />
        </div>

        {/* NC personal stat callouts (frame_0040 pattern). Always show
            cycle length; show period length and cover-line baseline
            when we have enough data. Each card mirrors NC's stacked
            stat block: small-caps label, big bold value, muted
            comparison line. Hides quietly when stats aren't ready
            (insufficient sample, etc.). */}
        {ctx.stats.meanCycleLength != null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
            <NCStatsCard
              label="My cycle length"
              value={
                ctx.stats.sdCycleLength != null
                  ? `${ctx.stats.meanCycleLength}±${ctx.stats.sdCycleLength} days`
                  : `${ctx.stats.meanCycleLength} days`
              }
              comparison={`Across ${ctx.stats.sampleSize} ${ctx.stats.sampleSize === 1 ? 'cycle' : 'cycles'} so far. The textbook range is 21 to 35 days.`}
              trailingPill={
                ctx.stats.regularity === 'regular'
                  ? { label: 'Regular', tone: 'positive' }
                  : ctx.stats.regularity === 'somewhat'
                    ? { label: 'Somewhat regular', tone: 'neutral' }
                    : ctx.stats.regularity === 'irregular'
                      ? { label: 'Variable', tone: 'warning' }
                      : undefined
              }
            />
            {ctx.stats.meanPeriodLength != null && (
              <NCStatsCard
                label="My period length"
                value={
                  ctx.stats.sdPeriodLength != null
                    ? `${ctx.stats.meanPeriodLength}±${ctx.stats.sdPeriodLength} days`
                    : `${ctx.stats.meanPeriodLength} days`
                }
                comparison="Most cycles bleed for three to seven days."
              />
            )}
            {ctx.coverLine.baseline != null && (
              <NCStatsCard
                label={
                  ctx.coverLine.kind === 'deviation'
                    ? 'My BBT baseline (Oura deviation)'
                    : 'My BBT baseline'
                }
                value={
                  ctx.coverLine.kind === 'absolute'
                    ? `${(ctx.coverLine.baseline * 1.8 + 32).toFixed(2)}°F`
                    : `${ctx.coverLine.baseline >= 0 ? '+' : '−'}${Math.abs(ctx.coverLine.baseline).toFixed(2)}° base`
                }
                comparison={
                  ctx.coverLine.sampleSize > 0
                    ? `Personal moving baseline from your last ${ctx.coverLine.sampleSize} readings.`
                    : undefined
                }
              />
            )}
          </div>
        )}

        {/* Period prompt: feeds every downstream prediction */}
        <Card padding="sm">
          <div data-tour-step="period-prompt">
            <PeriodTodaySheetLauncher date={today} initialMenstruating={menstruatingToday} />
          </div>
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
        <div data-tour-step="bbt-tile">
          <BbtTile date={today} latest={latestBbt} confirmedOvulation={ctx.confirmedOvulation} />
        </div>

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

        {/* Deeper insights link.
            Drives to /v2/cycle/insights (Wave 2): population
            comparison stats keyed to NC's Cycle Insights surface. */}
        <Card padding="none">
          <Link
            data-tour-step="explainer-chip"
            href="/v2/cycle/insights"
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
              subtext="Compare your cycle length, luteal phase, and more with population averages."
              chevron
              divider={false}
            />
          </Link>
        </Card>

        {/* Data correction affordance for today's cycle row. Lets the
            user fix NC misimports (forgot to log a period day,
            menstruation flag wrong) and the AI sees the correction in
            every future conversation. */}
        {todaysEntry && (
          <CorrectionsPanel
            tableName="cycle_entries"
            rowId={todaysEntry.id}
            source="v2_cycle"
            heading="Does today look wrong?"
            subtext="If a value is off (e.g. you bled today but the import missed it), fix it here."
            fields={[
              {
                label: 'Bleeding today',
                value: todaysEntry.menstruation,
                fieldName: 'menstruation',
                inputType: 'text',
                displayValue:
                  todaysEntry.menstruation === true
                    ? 'Yes'
                    : todaysEntry.menstruation === false
                      ? 'No'
                      : 'Not set',
              },
              {
                label: 'Flow level',
                value: todaysEntry.flow_level ?? null,
                fieldName: 'flow_level',
                inputType: 'text',
                displayValue:
                  todaysEntry.flow_level == null
                    ? 'Not set'
                    : String(todaysEntry.flow_level),
              },
              {
                label: 'Cervical mucus quantity',
                value: todaysEntry.cervical_mucus_quantity ?? null,
                fieldName: 'cervical_mucus_quantity',
                inputType: 'text',
                displayValue:
                  todaysEntry.cervical_mucus_quantity == null ||
                  todaysEntry.cervical_mucus_quantity === ''
                    ? 'Not set'
                    : String(todaysEntry.cervical_mucus_quantity),
              },
            ]}
          />
        )}

        {/* Contraceptive scope disclaimer */}
        <Banner
          intent="info"
          title="Awareness, not contraception"
          body="LanaeHealth tracks patterns for understanding. It is not an FDA-cleared contraceptive."
        />
          </div>
        </RouteSlide>
      </RefreshRouter>
      <CycleTourLauncher
        initialStep={tutorialProgress?.cycle.lastStep ?? 0}
        completed={tutorialProgress?.cycle.completed ?? false}
        dismissed={tutorialProgress?.cycle.dismissed ?? false}
        autoStartForFirstVisit={
          !tutorialProgress?.cycle.completed && !tutorialProgress?.cycle.dismissed
        }
      />
    </MobileShell>
  )
}
