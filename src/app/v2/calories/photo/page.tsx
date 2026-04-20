/*
 * v2 Calories » Photo meal log (stub)
 *
 * Deliberately honest "not ready" state. The backend route at
 * /api/food/identify does exist, but the upload, preview, and
 * confirmation flows around it are not built for v2 yet. Rather
 * than stand up a camera screen that greets Lanae with a blank
 * rectangle, we point at the search flow which already works
 * (USDA, barcode) and hides a broken door.
 *
 * When the photo flow is ready, replace this page with a real
 * capture UI. The route path itself is already linked from
 * QuickLogFabV2, so zero call sites need to change.
 */
import Link from 'next/link'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { EmptyState, Button } from '@/v2/components/primitives'

export const dynamic = 'force-dynamic'

export default function V2CaloriesPhotoStubPage() {
  return (
    <MobileShell
      top={
        <TopAppBar
          title="Photo meal log"
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
              {'\u2039'}
            </Link>
          }
        />
      }
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: 'var(--v2-space-4)',
          paddingTop: 'var(--v2-space-8)',
          paddingBottom: 'var(--v2-space-8)',
          maxWidth: 640,
          margin: '0 auto',
          width: '100%',
        }}
      >
        <EmptyState
          illustration={<span aria-hidden>{'\uD83D\uDCF7'}</span>}
          headline="Photo meals are coming soon"
          subtext="For now, try the Search tab. USDA has most things, and barcode scan is a tap away."
          cta={
            <Link
              href="/v2/calories/search"
              aria-label="Open search"
              style={{ textDecoration: 'none' }}
            >
              <Button variant="primary" size="lg">
                Go to search
              </Button>
            </Link>
          }
        />
      </div>
    </MobileShell>
  )
}
