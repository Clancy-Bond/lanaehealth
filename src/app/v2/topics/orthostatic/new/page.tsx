/*
 * /v2/topics/orthostatic/new (server shell)
 *
 * Thin wrapper around <OrthostaticLogForm />. The form itself is a
 * client component because it needs controlled state, a router.push on
 * success, and the beforeunload guard that protects a 5+ minute log
 * session from accidental navigation.
 *
 * Voice: one short NC-style line above the form reminding Lanae to log
 * each test as she finishes it. No further advice : the six section
 * headings say the rest.
 */
import Link from 'next/link'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import OrthostaticLogForm from './_components/OrthostaticLogForm'

export const metadata = { title: 'Log orthostatic test - LanaeHealth' }

export default function V2OrthostaticNewPage() {
  return (
    <MobileShell
      top={
        <TopAppBar
          variant="standard"
          title="Log orthostatic test"
          leading={
            <Link
              href="/v2/topics/orthostatic"
              aria-label="Back to orthostatic"
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
              &lsaquo; Orthostatic
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
          maxWidth: 640,
          margin: '0 auto',
          width: '100%',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-secondary)',
            lineHeight: 'var(--v2-leading-relaxed)',
          }}
        >
          Log each test as you finish it. Accurate resting numbers matter most.
        </p>
        <OrthostaticLogForm />
      </div>
    </MobileShell>
  )
}
