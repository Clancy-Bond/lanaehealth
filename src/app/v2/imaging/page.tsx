/*
 * /v2/imaging (server component)
 *
 * Reports-only imaging page for mobile. The DICOM viewer stays on
 * the legacy /imaging route because pinch/drag paging through
 * slices is a desktop experience; this surface is intentionally
 * scoped to reports + findings so a phone user can read what a
 * radiologist said without pretending to be a viewer.
 *
 * Fetch happens once, server-side, via createServiceClient() (same
 * RLS-safe pattern /v2/records and /v2/labs use). We throw on any
 * Supabase .error so a failed query is distinguishable from a user
 * who truly has no studies.
 *
 * Voice on the top-of-page banner follows NC: short, kind, with a
 * pointer to the desktop viewer for users who need the slices.
 */
import { Suspense } from 'react'
import { createServiceClient } from '@/lib/supabase'
import type { ImagingStudy } from '@/lib/types'
import { Banner, EmptyState } from '@/v2/components/primitives'
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
    <MobileShell top={<TopAppBar variant="large" title="Imaging" />}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-4)',
          padding: 'var(--v2-space-4)',
          paddingBottom: 'var(--v2-space-8)',
        }}
      >
        <Banner
          intent="info"
          title="Full viewer is desktop-only"
          body="This mobile view shows reports and findings. Open on a computer at /imaging to page through DICOM images."
        />

        {studies.length === 0 ? (
          <EmptyState
            headline="No imaging on file yet."
            subtext="Your radiology reports will show up here once a study is uploaded."
          />
        ) : (
          <Suspense fallback={null}>
            <ImagingClient studies={studies} />
          </Suspense>
        )}
      </div>
    </MobileShell>
  )
}
