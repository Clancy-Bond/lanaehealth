import { Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import type { ImagingStudy } from '@/lib/types'
import { ImagingViewerClient } from '@/components/imaging/ImagingViewerClient'

// Live Supabase data; skip build-time prerender (avoids env-less eval).
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Imaging Reports - LanaeHealth',
}

export default async function ImagingPage() {
  const { data } = await supabase
    .from('imaging_studies')
    .select('id, study_date, modality, body_part, indication, findings_summary, report_text, raw_data_path, created_at')
    .order('study_date', { ascending: false })

  const studies = (data || []) as ImagingStudy[]

  return (
    <Suspense
      fallback={
        <div
          className="flex items-center justify-center min-h-screen"
          style={{ background: 'var(--bg-primary)' }}
        >
          <div className="shimmer-bar" style={{ width: 240 }} aria-hidden="true" />
          <span className="sr-only">One moment, pulling your imaging.</span>
        </div>
      }
    >
      <ImagingViewerClient studies={studies} />
    </Suspense>
  )
}
