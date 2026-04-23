/*
 * /v2/calories/health/heart-rate (server component)
 *
 * Light HR tracker in v2 dark chrome. Mirrors the legacy page
 * structure :
 *   - Most-recent reading hero with context label
 *   - Last-30 trend sparkline (single line, auto-padded domain)
 *   - Log form (client) posting to /api/hr/log
 *   - Last-20 recent readings with context labels
 *
 * Same loader as the legacy route so the dataset never forks. The
 * resting HR from Oura lives under /v2/activity and is intentionally
 * not duplicated here : this page is for ad-hoc spot-checks (standing
 * HR, post-orthostatic HR, palpitation moments) that Oura can't see.
 */
import Link from 'next/link'
import { Card } from '@/v2/components/primitives'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { loadHeartRateLog } from '@/lib/calories/heart-rate'
import HRLatestCard from './_components/HRLatestCard'
import HRSparkline from './_components/HRSparkline'
import HRLogForm from './_components/HRLogForm'
import HRRecentList from './_components/HRRecentList'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Heart rate - LanaeHealth' }

export default async function V2HeartRatePage() {
  const log = await loadHeartRateLog()
  const latest = log.entries[0] ?? null

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="standard"
          title="Heart rate"
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
              &lsaquo; Calories
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
          maxWidth: 640,
          margin: '0 auto',
          width: '100%',
        }}
      >
        <HRLatestCard latest={latest} />

        {log.entries.length >= 2 && (
          <Card padding="md">
            <HRSparkline entries={log.entries} />
          </Card>
        )}

        <Card padding="md">
          <HRLogForm />
        </Card>

        <HRRecentList entries={log.entries} />
      </div>
    </MobileShell>
  )
}
