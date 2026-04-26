/*
 * /v2/import/apple-health (server shell)
 *
 * Thin wrapper around <AppleHealthWizard />. The wizard is client
 * because the upload + preview + confirm flow is a small state
 * machine that streams a file out of the browser. This file just
 * lays out the page chrome and the kind, NC-style intro line.
 */
import Link from 'next/link'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { Card } from '@/v2/components/primitives'
import AppleHealthWizard from './_components/AppleHealthWizard'

export const metadata = { title: 'Import from Apple Health - LanaeHealth' }

export default function V2ImportAppleHealthPage() {
  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="Import from Apple Health"
          leading={
            <Link
              href="/v2/import"
              aria-label="Back to import"
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
              &lsaquo; Import
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
        <Card variant="explanatory" padding="md">
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-surface-explanatory-text)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            Open the Health app on your iPhone, tap your profile in the top
            right, and choose Export All Health Data. Drop the export.zip
            here. We will preview what we found before saving anything.
          </p>
        </Card>
        <AppleHealthWizard />
      </div>
    </MobileShell>
  )
}
