/*
 * /v2/records (server component)
 *
 * Unified chronological timeline for labs, imaging, appointments,
 * milestones, and active problems. Mirrors the data contract of the
 * legacy /records page so row counts match on the same dataset; the
 * visual flip to v2 dark chrome lives in the client components under
 * _components/.
 *
 * Fetch happens once, server-side, via createServiceClient(). The merge
 * runs here too so we can hand a ready TimelineRow[] to the client.
 */

import { createServiceClient } from '@/lib/supabase'
import type {
  Appointment,
  ImagingStudy,
  LabResult,
  MedicalTimelineEvent,
} from '@/lib/types'
import {
  mergeTimeline,
  type ActiveProblemRow,
} from '@/lib/records/timeline-merge'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import RecordsClient from './_components/RecordsClient'

export const dynamic = 'force-dynamic'

export default async function V2RecordsPage() {
  const supabase = createServiceClient()

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
  const events = (timelineRes.data || []) as MedicalTimelineEvent[]
  const problems = (problemsRes.data || []) as ActiveProblemRow[]

  const rows = mergeTimeline({ labs, imaging, appointments, events, problems })

  return (
    <MobileShell top={<TopAppBar variant="large" title="Records" />}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-4)',
          padding: 'var(--v2-space-4)',
          paddingBottom: 'var(--v2-space-8)',
        }}
      >
        <RecordsClient rows={rows} />
      </div>
    </MobileShell>
  )
}
