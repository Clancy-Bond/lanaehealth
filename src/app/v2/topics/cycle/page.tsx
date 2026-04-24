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
import { getCurrentCycleDay } from '@/lib/cycle/current-day'
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

  const [current, cycleResult, ncResult] = await Promise.all([
    getCurrentCycleDay(today),
    sb
      .from('cycle_entries')
      .select('date, menstruation, flow_level')
      .gte('date', windowStart)
      .lte('date', today)
      .order('date', { ascending: true }),
    sb
      .from('nc_imported')
      .select('date, menstruation, flow_quantity')
      .gte('date', windowStart)
      .lte('date', today)
      .order('date', { ascending: true }),
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
      </div>
    </MobileShell>
  )
}
