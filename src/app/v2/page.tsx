/**
 * /v2: Home screen
 *
 * The app's front door. Chip strip of live metrics at the top,
 * a primary insight sentence below, quick alerts only when earned,
 * shortcuts to the drill sections. Everything on this page answers
 * the reader's implicit question: "what does any of this mean for
 * my day?"
 *
 * Data flows through a single loadHomeContext call. Sub-components
 * read from that context; they do not fan out new queries.
 */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { loadHomeContext } from '@/lib/v2/load-home-context'
import { getPrimaryInsight } from '@/lib/v2/primary-insight'
import { getCurrentUser } from '@/lib/auth/get-user'
import { getUserHomeLayout } from '@/lib/v2/home/layout-store'
import { isOnboarded } from '@/lib/v2/onboarding/state'
import HomeHeroStrip from './_components/HomeHeroStrip'
import PrimaryInsightCard from './_components/PrimaryInsightCard'
import MetricStripHorizontal from './_components/MetricStripHorizontal'
import HomeAlerts from './_components/HomeAlerts'
import ShortcutsGrid from './_components/ShortcutsGrid'
import SectionHeader from './_components/SectionHeader'
import AskAiCard from './_components/AskAiCard'
import HomeQuickActionFab from './_components/HomeQuickActionFab'
import HomeLayout from './_components/HomeLayout'
import RouteFade from './_components/RouteFade'
import RefreshRouter from './_components/RefreshRouter'
import RecoveryTimeCard from './_components/RecoveryTimeCard'
import { computeRecoveryTime } from '@/lib/v2/recovery-time'
import { median } from '@/lib/v2/home-signals'
import { getOuraData } from '@/lib/api/oura'

export const dynamic = 'force-dynamic'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/*
 * LEARNING-MODE HOOK H2: Home section order.
 *
 * The reader sees these sections in order on open. Decisions below
 * were made on two heuristics:
 *
 *   1. Frontload meaning. The insight card comes before numbers so
 *      raw metrics never arrive without context.
 *   2. Metrics before navigation. Chip strip precedes shortcuts so
 *      the question "what is true today" gets answered before the
 *      question "where do I go next".
 *
 * Alternative: metrics first (Oura's default), insight second. Swap
 * the two sections below to try it.
 */

function thirtyDaysAgoISO(today: string): string {
  const t = new Date(today + 'T00:00:00Z').getTime()
  return new Date(t - 30 * 86_400_000).toISOString().slice(0, 10)
}

function fourteenDaysAgoISO(today: string): string {
  const t = new Date(today + 'T00:00:00Z').getTime()
  return new Date(t - 14 * 86_400_000).toISOString().slice(0, 10)
}

export default async function V2HomePage() {
  const today = todayISO()
  // Recovery-time card needs a deeper window than home's default 7-day
  // ouraTrend, so we fetch the last 30 days separately. Failure is
  // non-fatal: the card simply degrades to "—" and the trajectory
  // pill reads 'Flat'.
  const [ctx, user, ouraRecent] = await Promise.all([
    loadHomeContext(today),
    getCurrentUser(),
    (async () => {
      try {
        return await getOuraData(thirtyDaysAgoISO(today), today)
      } catch {
        return []
      }
    })(),
  ])

  // Funnel new accounts into the onboarding wizard before the home
  // screen renders. Already-onboarded users (or anyone who skipped)
  // pass through. The check is wrapped in try/catch inside
  // isOnboarded so a transient DB error never traps the user here.
  if (user) {
    const onboarded = await isOnboarded(user.id)
    if (!onboarded) {
      redirect('/v2/onboarding/1')
    }
  }

  const layout = await getUserHomeLayout(user?.id ?? null)

  const insight = getPrimaryInsight({
    today,
    ouraTrend: ctx.ouraTrend,
    cycle: ctx.cycle,
    calories: ctx.calories,
  })

  // Recovery-time computation. Baseline is the median readiness over
  // the last 30 days; trajectory is computed over the last 14.
  const sortedRecent = [...ouraRecent].sort((a, b) => a.date.localeCompare(b.date))
  const baseline30 = median(sortedRecent.map((d) => d.readiness_score))
  const baselineScore =
    baseline30 != null && Number.isFinite(baseline30) && baseline30 > 0 ? baseline30 : 70
  const fourteen = fourteenDaysAgoISO(today)
  const last14Readiness = sortedRecent
    .filter((d) => d.date >= fourteen)
    .map((d) => ({ date: d.date, score: d.readiness_score }))
  const recoveryResult = computeRecoveryTime({
    readinessScores: last14Readiness,
    baselineScore,
  })

  const loggedCount = countLoggedSections(ctx)
  const totalCount = 5

  const hour = new Date().getHours()

  // The widget renderers are passed in here so the registry has
  // no React dependency. Each widget either uses its dedicated
  // node (primary insight, metric strip) or falls back to null
  // when the underlying data is absent.
  const renderers = {
    primaryInsight: <PrimaryInsightCard insight={insight} />,
    metricStrip: (
      <section>
        <SectionHeader
          eyebrow="Today"
          trailing={
            <Link
              href="/v2/today"
              style={{
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-accent-primary)',
                textDecoration: 'none',
              }}
            >
              See all
            </Link>
          }
        />
        <div style={{ marginTop: 'var(--v2-space-3)' }}>
          <MetricStripHorizontal ctx={ctx} />
        </div>
      </section>
    ),
    homeAlerts: <HomeAlerts ctx={ctx} />,
    shortcuts: (
      <section>
        <SectionHeader eyebrow="Jump to" />
        <div style={{ marginTop: 'var(--v2-space-3)' }}>
          <ShortcutsGrid />
        </div>
      </section>
    ),
    askAi: <AskAiCard />,
  }

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="Home"
          trailing={
            <Link
              href="/v2/settings"
              aria-label="Settings"
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
              ⚙
            </Link>
          }
        />
      }
      fab={<HomeQuickActionFab />}
    >
      <RefreshRouter>
        <RouteFade>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--v2-space-5)',
              padding: 'var(--v2-space-4)',
              paddingBottom: 'var(--v2-space-10)',
            }}
          >
            <HomeHeroStrip iso={today} hour={hour} loggedCount={loggedCount} totalCount={totalCount} />
            <HomeLayout ctx={ctx} layout={layout} renderers={renderers} />
            <RecoveryTimeCard result={recoveryResult} baselineScore={baselineScore} />
          </div>
        </RouteFade>
      </RefreshRouter>
    </MobileShell>
  )
}

/**
 * Count logged sections for the hero subtext. Five check-ins that
 * define "today is in": daily log exists, a pain score, a mood
 * marker (implied by daily log's daily_impact), sleep (via Oura or
 * manual), at least one symptom or note.
 */
function countLoggedSections(ctx: Awaited<ReturnType<typeof loadHomeContext>>): number {
  let n = 0
  if (ctx.dailyLog) n += 1
  if (ctx.dailyLog?.overall_pain != null) n += 1
  if (ctx.dailyLog?.daily_impact != null && ctx.dailyLog.daily_impact.length > 0) n += 1
  const latest = ctx.ouraTrend[ctx.ouraTrend.length - 1]
  if (latest?.date === ctx.today && latest.sleep_score != null) n += 1
  if (ctx.symptomsToday > 0) n += 1
  return n
}
