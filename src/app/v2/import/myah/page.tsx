/*
 * /v2/import/myah (server shell)
 *
 * Thin wrapper around <MyahWizard />. The wizard itself is a client
 * component because the entire choose -> paste -> review flow is
 * driven by a local state machine, each step transitions based on
 * user input, and the final step calls router.push on success.
 *
 * Voice: one short NC-style intro line above the wizard. Each step
 * carries its own micro-copy; we do not repeat the "paste text"
 * hint twice.
 */
import Link from 'next/link'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { Card } from '@/v2/components/primitives'
import MyahWizard from './_components/MyahWizard'

export const metadata = { title: 'Import from Adventist Health - LanaeHealth' }

export default function V2ImportMyahPage() {
  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="Import from Adventist Health"
          leading={
            <Link
              href="/v2/settings"
              aria-label="Back to settings"
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
              &lsaquo; Settings
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
          maxWidth: 640,
          margin: '0 auto',
          width: '100%',
        }}
      >
        <Card padding="md">
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            Paste text from the MyAH patient portal. We will parse it into
            labs, appointments, medications, or notes. You review before
            anything is saved.
          </p>
        </Card>
        <MyahWizard />
      </div>
    </MobileShell>
  )
}
