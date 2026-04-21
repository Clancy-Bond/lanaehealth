/*
 * /v2/topics/orthostatic (server component)
 *
 * POTS / orthostatic deep-dive for mobile. Clones the legacy
 * /topics/orthostatic page structure into v2 dark chrome:
 *   - Diagnostic progress ring against the 3-positives-14-days rule
 *   - Latest test detail with classification pill
 *   - At-a-glance summary (30d median, 60d positives, all-time count)
 *   - Peak-rise trend sparkline
 *   - Plain-English explainer on the NC cream surface
 *
 * Voice follows the non-shaming rule. This is a reading + reference
 * page, not a nudge surface. No "you should" phrasing anywhere.
 *
 * The orthostatic_tests table may not be migrated onto every Supabase
 * environment yet. We match the legacy API guard pattern
 * (src/app/api/orthostatic/route.ts:25) so a missing table renders an
 * EmptyState instead of a 500.
 */
import Link from 'next/link'
import { format } from 'date-fns'
import { createServiceClient } from '@/lib/supabase'
import { summarize, type OrthostaticTest } from '@/lib/intelligence/orthostatic'
import { EmptyState } from '@/v2/components/primitives'
import { MobileShell, TopAppBar, FAB } from '@/v2/components/shell'
import DiagnosticProgressCard from './_components/DiagnosticProgressCard'
import LatestTestCard from './_components/LatestTestCard'
import AtAGlanceCard from './_components/AtAGlanceCard'
import OrthostaticTrendSparkline from './_components/OrthostaticTrendSparkline'
import OrthostaticExplainerCard from './_components/OrthostaticExplainerCard'

export const dynamic = 'force-dynamic'

const NEW_TEST_HREF = '/v2/topics/orthostatic/new'

export default async function V2OrthostaticTopicPage() {
  const sb = createServiceClient()
  const today = format(new Date(), 'yyyy-MM-dd')

  const { data, error } = await sb
    .from('orthostatic_tests')
    .select('*')
    .order('test_date', { ascending: false })

  // The legacy API guards for a not-yet-migrated table with the same
  // regex. Treat that as "no data" rather than a hard failure so the
  // rest of the /v2 surface keeps working on environments where 013
  // has not been applied.
  const tableMissing =
    !!error && /relation .* does not exist/i.test(error.message)

  if (error && !tableMissing) {
    throw new Error(`Orthostatic fetch failed: ${error.message}`)
  }

  const rows = ((data ?? []) as unknown) as OrthostaticTest[]
  const hasAny = rows.length > 0
  const summary = hasAny ? summarize(rows, today) : null

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="Orthostatic"
          trailing={
            <Link
              href={NEW_TEST_HREF}
              aria-label="Log orthostatic test"
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
              Log test
            </Link>
          }
        />
      }
      fab={
        <Link
          href={NEW_TEST_HREF}
          aria-label="Log orthostatic test"
          style={{ textDecoration: 'none' }}
        >
          <FAB label="Log orthostatic test" variant="floating" />
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
        {!summary ? (
          <EmptyState
            headline="No orthostatic tests yet."
            subtext="We haven't seen any orthostatic tests yet. Log one to start tracking your peak rise pattern."
          />
        ) : (
          <>
            <DiagnosticProgressCard
              diagnosticProgress={summary.diagnosticProgress}
            />
            <LatestTestCard latest={summary.latest} />
            <AtAGlanceCard
              median30dPeakRise={summary.median30dPeakRise}
              positiveLast60Days={summary.positiveLast60Days}
              totalTests={summary.tests.length}
            />
            <OrthostaticTrendSparkline tests={summary.tests} />
            <OrthostaticExplainerCard />
          </>
        )}
      </div>
    </MobileShell>
  )
}
