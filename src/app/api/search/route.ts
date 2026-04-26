/**
 * Global Search API
 *
 * GET /api/search?q=<query>
 *
 * Backs the Cmd/Ctrl+K palette. Runs four parallel ilike queries against
 * the user's data and returns at most 5 hits per category. Categories are
 * deliberately separate so the palette can render them under section
 * headers (Raycast pattern from docs/design/2026-findings.md §3).
 *
 * Returns empty arrays when query length is below 2 characters so the
 * client never sees half-matches on a single keystroke.
 */

import { createServiceClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { resolveUserId, UserIdUnresolvableError } from '@/lib/auth/resolve-user-id'

export const dynamic = 'force-dynamic'

interface LabHit {
  id: string
  test_name: string
  value: number | null
  unit: string | null
  flag: string | null
  date: string
}

interface ProblemHit {
  id: string
  problem: string
  status: string | null
  severity: string | null
}

interface AppointmentHit {
  id: string
  title: string | null
  provider: string | null
  date: string | null
}

interface ImagingHit {
  id: string
  modality: string | null
  body_part: string | null
  study_date: string | null
}

interface SearchResponse {
  query: string
  labs: LabHit[]
  problems: ProblemHit[]
  appointments: AppointmentHit[]
  imaging: ImagingHit[]
  totalHits: number
}

function emptyResponse(query: string): SearchResponse {
  return {
    query,
    labs: [],
    problems: [],
    appointments: [],
    imaging: [],
    totalHits: 0,
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const rawQuery = (url.searchParams.get('q') || '').trim()

  if (rawQuery.length < 2) {
    return NextResponse.json(emptyResponse(rawQuery))
  }

  // Resolve user_id so search only returns THIS user's records.
  let userId: string
  try {
    const r = await resolveUserId()
    userId = r.userId
  } catch (err) {
    if (err instanceof UserIdUnresolvableError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: 'auth check failed' }, { status: 500 })
  }

  // ilike pattern. Escape % and _ so user input cannot inject wildcards
  // into the LIKE expression itself.
  const escaped = rawQuery.replace(/[%_]/g, (m) => `\\${m}`)
  const pattern = `%${escaped}%`

  const supabase = createServiceClient()

  const [labsRes, problemsRes, apptsRes, imagingRes] = await Promise.all([
    supabase
      .from('lab_results')
      .select('id, test_name, value, unit, flag, date')
      .eq('user_id', userId)
      .ilike('test_name', pattern)
      .order('date', { ascending: false })
      .limit(5),
    supabase
      .from('active_problems')
      .select('id, problem, status, severity')
      .eq('user_id', userId)
      .ilike('problem', pattern)
      .limit(5),
    supabase
      .from('appointments')
      .select('id, title, provider, date')
      .eq('user_id', userId)
      .or(`title.ilike.${pattern},provider.ilike.${pattern}`)
      .order('date', { ascending: false })
      .limit(5),
    supabase
      .from('imaging_studies')
      .select('id, modality, body_part, study_date')
      .eq('user_id', userId)
      .or(`modality.ilike.${pattern},body_part.ilike.${pattern}`)
      .order('study_date', { ascending: false })
      .limit(5),
  ])

  const labs = (labsRes.data as LabHit[] | null) || []
  const problems = (problemsRes.data as ProblemHit[] | null) || []
  const appointments = (apptsRes.data as AppointmentHit[] | null) || []
  const imaging = (imagingRes.data as ImagingHit[] | null) || []

  const response: SearchResponse = {
    query: rawQuery,
    labs,
    problems,
    appointments,
    imaging,
    totalHits: labs.length + problems.length + appointments.length + imaging.length,
  }

  return NextResponse.json(response)
}
