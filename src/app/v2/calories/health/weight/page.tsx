import Link from 'next/link'
import { format } from 'date-fns'
import {
  loadWeightLog,
  latestEntry,
  entryDaysAgo,
  kgToLb,
} from '@/lib/calories/weight'
import { loadNutritionGoals } from '@/lib/calories/goals'
import { loadPersonalProfile } from '@/lib/calories/personal-profile'
import { calculateBMI } from '@/lib/calories/body-metrics'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { Banner, Card, EmptyState } from '@/v2/components/primitives'
import WeightCurrentCard from './_components/WeightCurrentCard'
import WeightTrendSparkline from './_components/WeightTrendSparkline'
import WeighInForm from './_components/WeighInForm'
import WeightDerivedRow from './_components/WeightDerivedRow'

export const dynamic = 'force-dynamic'

/*
 * /v2/calories/health/weight
 *
 * Weight-log home. Three blocks vertically: the current-reading
 * headline with deltas (WeightCurrentCard), the 30-day trend
 * (WeightTrendSparkline), and a weigh-in form (WeighInForm) that
 * writes via a local server action.
 *
 * When no entries exist the current card and sparkline are
 * suppressed in favor of an EmptyState; the form stays visible so
 * the first weigh-in is always one tap away.
 *
 * The existing POST /api/weight/log API route is kept untouched;
 * this route uses a server action instead so the form works without
 * JavaScript and stays scoped to the v2 tree.
 */

function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export default async function V2WeightPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>
}) {
  const params = await searchParams
  const saved = params.saved === '1'
  const error = params.error ?? null

  const [log, goals, profile] = await Promise.all([
    loadWeightLog(),
    loadNutritionGoals(),
    loadPersonalProfile(),
  ])
  const latest = latestEntry(log)
  const weekAgo = entryDaysAgo(log, 7)
  const monthAgo = entryDaysAgo(log, 30)
  const latestLb = latest ? kgToLb(latest.kg) : null
  const weekAgoLb = weekAgo ? kgToLb(weekAgo.kg) : null
  const monthAgoLb = monthAgo ? kgToLb(monthAgo.kg) : null
  const targetLb = goals.weight.targetKg !== null ? kgToLb(goals.weight.targetKg) : null
  const isToday = latest?.date === todayISO()
  const hasEntries = log.entries.length > 0

  // Compute BMI when weight + height available (Phase 4: comprehensive metrics).
  let bmiResult: { bmi: number; category: string } | null = null
  if (latest && profile.height_cm) {
    bmiResult = calculateBMI(latest.kg, profile.height_cm)
  }

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="standard"
          title="Weight"
          leading={
            <Link
              href="/v2/calories"
              aria-label="Back to calories"
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
              {'\u2039'}
            </Link>
          }
        />
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
        {saved && <Banner intent="success" title="Saved." />}

        {hasEntries ? (
          <>
            <WeightCurrentCard
              latestLb={latestLb}
              latestDate={latest?.date ?? null}
              isToday={isToday}
              weekAgoLb={weekAgoLb}
              monthAgoLb={monthAgoLb}
              targetLb={targetLb}
            />

            <WeightTrendSparkline entries={log.entries} anchorISO={todayISO()} />

            {bmiResult && (
              <WeightDerivedRow bmi={bmiResult.bmi} category={bmiResult.category} />
            )}
          </>
        ) : (
          <Card padding="md">
            <EmptyState
              headline="No weigh-ins yet"
              subtext="Tap to add your first. One reading is data; a few is a line."
              cta={
                <a
                  href="#weigh-in-lb"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 44,
                    padding: '0 var(--v2-space-5)',
                    borderRadius: 'var(--v2-radius-full)',
                    background: 'var(--v2-accent-primary)',
                    color: 'var(--v2-on-accent)',
                    border: '1px solid var(--v2-accent-primary)',
                    fontSize: 'var(--v2-text-base)',
                    fontWeight: 'var(--v2-weight-semibold)',
                    textDecoration: 'none',
                    fontFamily: 'inherit',
                  }}
                >
                  Add your first
                </a>
              }
            />
          </Card>
        )}

        <WeighInForm error={error} />
      </div>
    </MobileShell>
  )
}
