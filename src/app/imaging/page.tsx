import { Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import type { ImagingStudy } from '@/lib/types'
import { ImagingViewerClient } from '@/components/imaging/ImagingViewerClient'

export default async function ImagingPage() {
  const { data } = await supabase
    .from('imaging_studies')
    .select('*')
    .order('study_date', { ascending: false })

  const studies = (data || []) as ImagingStudy[]

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Loading imaging viewer...
          </p>
        </div>
      }
    >
      <ImagingViewerClient studies={studies} />
    </Suspense>
  )
}
