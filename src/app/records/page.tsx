import { supabase } from '@/lib/supabase'
import type {
  LabResult,
  Appointment,
  ImagingStudy,
  MedicalTimelineEvent,
} from '@/lib/types'
import type { ActiveProblemRow } from '@/lib/records/timeline-merge'
import { RecordsClient } from '@/components/records/RecordsClient'

// Live Supabase data; skip build-time prerender.
export const dynamic = 'force-dynamic'

export default async function RecordsPage() {
  // Wave 2c D1+F6 added active_problems so problems surface in the unified
  // chronological timeline alongside labs / imaging / appointments / events.
  const [labRes, imagingRes, appointmentsRes, timelineRes, problemsRes] =
    await Promise.all([
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
      supabase
        .from('active_problems')
        .select('id, problem, status, onset_date, latest_data, linked_diagnoses')
        .neq('status', 'resolved')
        .order('onset_date', { ascending: false, nullsFirst: false }),
    ])

  const labs = (labRes.data || []) as LabResult[]
  const imaging = (imagingRes.data || []) as ImagingStudy[]
  const appointments = (appointmentsRes.data || []) as Appointment[]
  const timeline = (timelineRes.data || []) as MedicalTimelineEvent[]
  const problems = (problemsRes.data || []) as ActiveProblemRow[]

  return (
    <div className="route-desktop-wide mx-auto px-4 pt-6 pb-safe">
      <h1 className="page-title">Your records</h1>
      <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Labs, imaging, appointments, and the events that shaped your history.
      </p>

      <RecordsClient
        labs={labs}
        imaging={imaging}
        appointments={appointments}
        timeline={timeline}
        problems={problems}
      />
    </div>
  )
}
