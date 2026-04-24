import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { MobileShell, TopAppBar } from '@/v2/components/shell'

export default function Page() {
  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="Cycle report"
          leading={
            <Link
              href="/v2/doctor"
              aria-label="Back to doctor"
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
        />
      }
    >
      <div style={{ padding: 'var(--v2-space-6)' }}>
        <p style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-muted)' }}>
          v2 stub: /v2/doctor/cycle-report
        </p>
      </div>
    </MobileShell>
  )
}
