/*
 * ScanStubSection
 *
 * Honest "not-ready" state. The web shell can't reliably hit the
 * camera on iOS Safari, and a fake scanner would teach Lanae to
 * trust a control that won't show up on her doctor reports. So we
 * own the gap: name what works (Search by name), point there.
 *
 * When the native shell ships, this component swaps to the real
 * scanner without any caller changes.
 */

import Link from 'next/link'
import { EmptyState } from '@/v2/components/primitives'

export default function ScanStubSection({ meal }: { meal: string }) {
  const params = new URLSearchParams({ view: 'search' })
  if (meal) params.set('meal', meal)
  return (
    <EmptyState
      headline="Scan is coming"
      subtext="Barcode scanning works best from the native app. For now, search by name."
      cta={
        <Link
          href={`/v2/calories/search?${params.toString()}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 'var(--v2-touch-target-min)',
            padding: '0 var(--v2-space-5)',
            borderRadius: 'var(--v2-radius-full)',
            background: 'var(--v2-accent-primary)',
            color: 'var(--v2-bg-primary)',
            textDecoration: 'none',
            fontSize: 'var(--v2-text-base)',
            fontWeight: 'var(--v2-weight-semibold)',
          }}
        >
          Search by name
        </Link>
      }
    />
  )
}
