/*
 * /v2/calories/health/blood-pressure (server component)
 *
 * Light BP tracker in v2 dark chrome. Mirrors the legacy page structure
 * :
 *   - Most-recent reading hero with classification pill
 *   - Last-30 trend sparkline (systolic + diastolic)
 *   - Log form (client) posting to /api/bp/log
 *   - Last-20 recent readings with classification pills
 *
 * Same loader + classifier as the legacy route so the dataset never
 * forks. Voice follows the non-shaming rule : no "you should" copy.
 */
import Link from 'next/link'
import { Card } from '@/v2/components/primitives'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { loadBloodPressureLog } from '@/lib/calories/blood-pressure'
import BPLatestCard from './_components/BPLatestCard'
import BPSparkline from './_components/BPSparkline'
import BPLogForm from './_components/BPLogForm'
import BPRecentList from './_components/BPRecentList'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Blood pressure - LanaeHealth' }

export default async function V2BloodPressurePage() {
  const log = await loadBloodPressureLog()
  const latest = log.entries[0] ?? null

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="standard"
          title="Blood pressure"
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
        <BPLatestCard latest={latest} />

        {log.entries.length >= 2 && (
          <Card padding="md">
            <BPSparkline entries={log.entries} />
          </Card>
        )}

        <Card padding="md">
          <BPLogForm />
        </Card>

        <BPRecentList entries={log.entries} />
      </div>
    </MobileShell>
  )
}
