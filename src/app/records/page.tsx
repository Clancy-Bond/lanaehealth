import { supabase } from '@/lib/supabase'
import type { LabResult, Appointment, ImagingStudy, MedicalTimelineEvent } from '@/lib/types'
import { RecordsClient } from '@/components/records/RecordsClient'

export default async function RecordsPage() {
  // Fetch all data in parallel
  const [labRes, imagingRes, appointmentsRes, timelineRes] = await Promise.all([
    supabase
      .from('lab_results')
      .select('*')
      .order('date', { ascending: false }),
    supabase
      .from('imaging_studies')
      .select('*')
      .order('study_date', { ascending: false }),
    supabase
      .from('appointments')
      .select('*')
      .order('date', { ascending: false }),
    supabase
      .from('medical_timeline')
      .select('*')
      .order('event_date', { ascending: false }),
  ])

  const labs = (labRes.data || []) as LabResult[]
  const imaging = (imagingRes.data || []) as ImagingStudy[]
  const appointments = (appointmentsRes.data || []) as Appointment[]
  const timeline = (timelineRes.data || []) as MedicalTimelineEvent[]

  return (
    <div className="px-4 pt-6 pb-safe">
      <h1 className="page-title">Records</h1>
      <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Lab results, imaging, appointments, and medical history
      </p>

      <RecordsClient
        labs={labs}
        imaging={imaging}
        appointments={appointments}
        timeline={timeline}
      />
    </div>
  )
}
