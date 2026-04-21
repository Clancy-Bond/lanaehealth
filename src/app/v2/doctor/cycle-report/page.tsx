import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase'
import { buildCycleReport } from '@/lib/reports/cycle-report'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import CycleReportView from '../_components/CycleReportView'

export const dynamic = 'force-dynamic'

/*
 * /v2/doctor/cycle-report
 *
 * One-tap OB/GYN cycle report. Uses the unmodified buildCycleReport
 * lib helper. Rendered on the explanatory surface so it prints clean
 * on the OB/GYN's exam-room printer.
 */
export default async function V2CycleReportPage() {
  const sb = createServiceClient()
  const today = new Date().toISOString().split('T')[0]
  const report = await buildCycleReport(sb, today)

  return (
    <MobileShell
      top={
        <TopAppBar
          title="Cycle Health Report"
          trailing={
            <Link
              href="/v2/doctor"
              style={{
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-secondary)',
                textDecoration: 'none',
                padding: 'var(--v2-space-2)',
              }}
            >
              Back
            </Link>
          }
        />
      }
      bottom={null}
    >
      <div className="v2-surface-explanatory" style={{ minHeight: '100%' }}>
        <div
          style={{
            maxWidth: 720,
            margin: '0 auto',
            padding: 'var(--v2-space-5) var(--v2-space-4) var(--v2-space-8)',
          }}
        >
          <CycleReportView report={report} today={today} />
        </div>
      </div>
    </MobileShell>
  )
}
