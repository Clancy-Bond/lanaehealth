import { Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import type { ImagingStudy } from '@/lib/types'
import { ImagingViewerClient } from '@/components/imaging/ImagingViewerClient'

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
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Loading imaging reports...
          </p>
        </div>
      }
    >
      <ImagingViewerClient studies={studies} />
    </Suspense>
  )
}
