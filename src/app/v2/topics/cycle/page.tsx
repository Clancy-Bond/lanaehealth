/*
 * /v2/topics/cycle (server component)
 *
 * Condition-focused menstrual cycle deep-dive. This is the READING
 * page: phase education and last-6-cycles distribution. NOT the daily
 * /v2/cycle tracker (that is the Phase 1 surface at src/app/v2/cycle/
 * page.tsx).
 *
 * Clones the legacy /topics/cycle structure into v2 dark chrome:
 *   1. Intro banner stating the ACOG typical range
 *   2. "Today" card with current CD + phase from the shared engine
 *   3. PhaseExplainerCard on the NC cream surface
 *   4. CycleLengthsChart showing up to 6 most recent cycle lengths
 *
 * The FAB links to the daily tracker's log entry so readers can jump
 * to logging without backing out; a trailing "History" link mirrors
 * the /v2/cycle route so the two topic anchors are navigationally
 * symmetric.
 *
 * We call getCurrentCycleDay() so this page always agrees with the
 * home screen and the daily tracker. deriveCycleLengths() is kept
 * section-local per Session 05 because the chart filter rules (gap >
 * 60 days = amenorrhea, drop from list) are a presentation detail
 * specific to last-6-cycle views, not the authoritative engine.
 */
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { format } from 'date-fns'
import { createServiceClient } from '@/lib/supabase'
import { runScopedQuery } from '@/lib/auth/scope-query'
import { getCurrentUser } from '@/lib/auth/get-user'
import { getCurrentCycleDay } from '@/lib/cycle/current-day'
import { Card } from '@/v2/components/primitives'
import { MobileShell, TopAppBar, FAB } from '@/v2/components/shell'
import CycleTopicIntroBanner from './_components/CycleTopicIntroBanner'
import TopicCycleTodayCard from './_components/TopicCycleTodayCard'
import PhaseExplainerCard from './_components/PhaseExplainerCard'
import CycleLengthsChart from './_components/CycleLengthsChart'
import {
  deriveCycleLengths,
  type CompletedCycle,
} from './_components/deriveCycleLengths'

export const dynamic = 'force-dynamic'

const LOG_HREF = '/v2/cycle/log'
const HISTORY_HREF = '/v2/cycle/history'

interface CycleEntryRow {
  date: string
  menstruation: boolean | null
  flow_level: string | null
}

interface NcImportedRow {
  date: string
  menstruation: string | null
  flow_quantity: string | null
}

export default async function V2CycleTopicPage() {
  const sb = createServiceClient()
  const now = new Date()
  const today = format(now, 'yyyy-MM-dd')
  // 240 days of history feeds the last-6-cycles view (enough runway
  // for someone with long or irregular cycles; deriveCycleLengths
  // drops > 60-day gaps so tail noise cannot distort the view).
  const windowStart = format(
    new Date(now.getTime() - 240 * 86400000),
    'yyyy-MM-dd',
  )

  const user = await getCurrentUser()
  const userId = user?.id ?? null
  const [current, cycleResult, ncResult] = await Promise.all([
    getCurrentCycleDay(today, userId),
    runScopedQuery({
      table: 'cycle_entries',
      userId,
      withFilter: () =>
        sb
          .from('cycle_entries')
          .select('date, menstruation, flow_level')
          .gte('date', windowStart)
          .lte('date', today)
          .eq('user_id', userId as string)
          .order('date', { ascending: true }),
      withoutFilter: () =>
        sb
          .from('cycle_entries')
          .select('date, menstruation, flow_level')
          .gte('date', windowStart)
          .lte('date', today)
          .order('date', { ascending: true }),
    }),
    runScopedQuery({
      table: 'nc_imported',
      userId,
      withFilter: () =>
        sb
          .from('nc_imported')
          .select('date, menstruation, flow_quantity')
          .gte('date', windowStart)
          .lte('date', today)
          .eq('user_id', userId as string)
          .order('date', { ascending: true }),
      withoutFilter: () =>
        sb
          .from('nc_imported')
          .select('date, menstruation, flow_quantity')
          .gte('date', windowStart)
          .lte('date', today)
          .order('date', { ascending: true }),
    }),
  ])

  if (cycleResult.error) {
    throw new Error(`cycle_entries fetch failed: ${cycleResult.error.message}`)
  }
  if (ncResult.error) {
    throw new Error(`nc_imported fetch failed: ${ncResult.error.message}`)
  }

  const cycleRows = (cycleResult.data ?? []) as CycleEntryRow[]
  const ncRows = (ncResult.data ?? []) as NcImportedRow[]
  const cycles: CompletedCycle[] = deriveCycleLengths(cycleRows, ncRows)

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="Menstrual cycle"
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
              <ChevronLeft size={22} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          }
          trailing={
            <Link
              href={HISTORY_HREF}
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
        <Link
          href={LOG_HREF}
          aria-label="Log cycle entry"
          style={{ textDecoration: 'none' }}
        >
          <FAB label="Log cycle entry" variant="floating" />
        </Link>
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
        <CycleTopicIntroBanner />
        <TopicCycleTodayCard
          day={current.day}
          phase={current.phase}
          isUnusuallyLong={current.isUnusuallyLong}
        />
        <PhaseExplainerCard />
        <CycleLengthsChart cycles={cycles} />
        <Card>
          <h2
            style={{
              margin: 0,
              marginBottom: 'var(--v2-space-2)',
              fontSize: 'var(--v2-text-lg)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
              lineHeight: 'var(--v2-leading-normal)',
            }}
          >
            Tests for cycle workup
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            For irregular cycles, suspected anovulation, or perimenstrual symptom flares, a
            cycle-phase timed sex hormone panel is the next step.
          </p>
          <div style={{ marginTop: 'var(--v2-space-3)' }}>
            <Link
              href="/v2/insurance/tests/sex-hormone-panel-by-cycle-phase"
              style={{
                display: 'block',
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-accent-primary)',
                textDecoration: 'none',
                padding: 'var(--v2-space-2) 0',
              }}
            >
              Sex hormone panel guide
            </Link>
            <Link
              href="/v2/insurance/tests/category/endocrinology"
              style={{
                display: 'block',
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-accent-primary)',
                textDecoration: 'none',
                padding: 'var(--v2-space-2) 0',
              }}
            >
              Endocrinology tests
            </Link>
            <Link
              href="/v2/learn/how-to-talk-to-your-doctor-about-hormone-testing"
              style={{
                display: 'block',
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-accent-primary)',
                textDecoration: 'none',
                padding: 'var(--v2-space-2) 0',
              }}
            >
              How to talk to your doctor about hormone testing
            </Link>
          </div>
        </Card>

        <Card>
          <h2
            style={{
              margin: 0,
              marginBottom: 'var(--v2-space-2)',
              fontSize: 'var(--v2-text-lg)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
              lineHeight: 'var(--v2-leading-normal)',
            }}
          >
            Learn more
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            Plain-English articles on cycles, periods, hormones, and what to ask your doctor.
            Every clinical claim is sourced.
          </p>
          <div style={{ marginTop: 'var(--v2-space-3)' }}>
            <Link
              href="/v2/learn"
              style={{
                display: 'block',
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-accent-primary)',
                textDecoration: 'none',
                padding: 'var(--v2-space-2) 0',
              }}
            >
              Open the Learn library
            </Link>
          </div>
        </Card>
      </div>
    </MobileShell>
  )
}
