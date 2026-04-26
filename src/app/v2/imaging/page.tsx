/*
 * /v2/imaging (server component)
 *
 * Mobile imaging surface. Ships both the radiology reports view and
 * the full DICOM viewer behind a SegmentedControl; the viewer is an
 * iframe against /pacs.html (the legacy static viewer) so there is
 * no second copy of the PACS shell to maintain.
 *
 * Fetch happens once, server-side, via createServiceClient() (same
 * RLS-safe pattern /v2/records and /v2/labs use). We throw on any
 * Supabase .error so a failed query is distinguishable from a user
 * who truly has no studies.
 */
import { Suspense } from 'react'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase'
import type { ImagingStudy } from '@/lib/types'
import { EmptyState } from '@/v2/components/primitives'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import ImagingClient from './_components/ImagingClient'

export const dynamic = 'force-dynamic'

export default async function V2ImagingPage() {
  const sb = createServiceClient()

  const { data, error } = await sb
    .from('imaging_studies')
    .select('*')
    .order('study_date', { ascending: false })

  if (error) {
    throw new Error(`Imaging fetch failed: ${error.message}`)
  }

  const studies = (data ?? []) as ImagingStudy[]

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="Imaging"
          leading={
            <Link
              href="/v2"
              aria-label="Back to home"
              style={{
                color: 'var(--v2-text-secondary)',
                fontSize: 'var(--v2-text-lg)',
                padding: 'var(--v2-space-2)',
                textDecoration: 'none',
                minHeight: 'var(--v2-touch-target-min)',
                minWidth: 'var(--v2-touch-target-min)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ←
            </Link>
          }
        />
      }
    >
      {studies.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-4)',
            padding: 'var(--v2-space-4)',
            paddingBottom: 'var(--v2-space-10)',
          }}
        >
          <EmptyState
            headline="No imaging on file yet."
            subtext="Your radiology reports will show up here once a study is uploaded."
          />
        </div>
      ) : (
        <Suspense fallback={null}>
          <ImagingClient studies={studies} />
        </Suspense>
      )}
    </MobileShell>
  )
}
