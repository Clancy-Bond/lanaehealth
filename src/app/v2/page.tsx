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
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { loadHomeContext } from '@/lib/v2/load-home-context'
import { getPrimaryInsight } from '@/lib/v2/primary-insight'
import HomeHeroStrip from './_components/HomeHeroStrip'
import PrimaryInsightCard from './_components/PrimaryInsightCard'
import MetricStripHorizontal from './_components/MetricStripHorizontal'
import HomeAlerts from './_components/HomeAlerts'
import ShortcutsGrid from './_components/ShortcutsGrid'
import SectionHeader from './_components/SectionHeader'
import AskAiCard from './_components/AskAiCard'
import HomeQuickActionFab from './_components/HomeQuickActionFab'

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

export default async function V2HomePage() {
  const today = todayISO()
  const ctx = await loadHomeContext(today)

  const insight = getPrimaryInsight({
    today,
    ouraTrend: ctx.ouraTrend,
    cycle: ctx.cycle,
    calories: ctx.calories,
  })

  const loggedCount = countLoggedSections(ctx)
  const totalCount = 5

  const hour = new Date().getHours()

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

        <PrimaryInsightCard insight={insight} />

        <AskAiCard />

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

        <HomeAlerts ctx={ctx} />

        <section>
          <SectionHeader eyebrow="Jump to" />
          <div style={{ marginTop: 'var(--v2-space-3)' }}>
            <ShortcutsGrid />
          </div>
        </section>
      </div>
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
