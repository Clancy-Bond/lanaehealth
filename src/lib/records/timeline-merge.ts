/**
 * Wave 2c D1+F6 - Unified Records Timeline: merge logic
 *
 * Pure, read-only transformation that takes the four record streams that back
 * /records (lab_results, imaging_studies, appointments, medical_timeline) plus
 * active_problems, normalizes them onto a shared `TimelineRow` shape, and
 * returns a single chronologically sorted stream.
 *
 * The shape is intentionally narrow so the UI can reason about rows without
 * special-casing each source. The `raw` field carries the original record in
 * case a row needs to render specialty-specific details (like a lab sparkline).
 *
 * READ-ONLY. No writes. No database calls. Fully unit-testable.
 */

import type {
  Appointment,
  ImagingStudy,
  LabResult,
  MedicalTimelineEvent,
} from '@/lib/types'

// ── Active problem type (no full row type exported from lib/types.ts) ─

export interface ActiveProblemRow {
  id: string
  problem: string
  status: string
  onset_date: string | null
  latest_data: string | null
  linked_diagnoses?: string[] | null
}

// ── Shared row shape ───────────────────────────────────────────────────

export type TimelineKind =
  | 'lab'
  | 'imaging'
  | 'appointment'
  | 'event'
  | 'problem'

/**
 * A single row in the unified records timeline.
 *
 * `date` is always a YYYY-MM-DD string so rows can be compared lexically
 * without constructing Date objects.
 *
 * `specialty` is the canonical facet used by ProviderBadge + FilterChipBar.
 * For labs we derive it from category; for imaging from modality; for
 * appointments from the `specialty` column; for events + problems it is
 * a best-effort inference and may be null.
 */
export interface TimelineRow {
  id: string
  date: string
  kind: TimelineKind
  title: string
  summary: string | null
  specialty: string | null
  severity: 'info' | 'watch' | 'critical'
  raw:
    | { kind: 'lab'; data: LabResult }
    | { kind: 'imaging'; data: ImagingStudy }
    | { kind: 'appointment'; data: Appointment }
    | { kind: 'event'; data: MedicalTimelineEvent }
    | { kind: 'problem'; data: ActiveProblemRow }
}

// ── Specialty inference helpers ────────────────────────────────────────

/**
 * Map lab category to a provider-style specialty bucket. Used both to color
 * code lab rows and to filter by the same chips that gate appointments.
 */
export function specialtyForLab(category: string | null | undefined): string {
  if (!category) return 'Labs'
  const lc = category.toLowerCase()
  if (lc === 'hormones' || lc === 'reproductive') return 'OB/GYN'
  if (lc === 'lipids' || lc === 'cardio') return 'Cardiology'
  if (lc === 'inflammation' || lc === 'immunology') return 'Rheumatology'
  // Everything else (CBC, Iron Studies, Vitamins, Metabolic, Coagulation, Other)
  // stays generic and shows under "Labs".
  return 'Labs'
}

/**
 * Map imaging modality to a specialty bucket. Falls back to "Imaging" when
 * we can't infer.
 */
export function specialtyForImaging(modality: string): string {
  const m = modality.toUpperCase()
  if (m === 'MRI' || m === 'CT') return 'Imaging'
  if (m === 'EKG') return 'Cardiology'
  return 'Imaging'
}

/** Translate a lab flag into the severity axis used across all kinds. */
export function severityForLabFlag(
  flag: string | null | undefined
): TimelineRow['severity'] {
  if (flag === 'critical') return 'critical'
  if (flag === 'high' || flag === 'low') return 'watch'
  return 'info'
}

// ── Per-source normalizers ─────────────────────────────────────────────

function normalizeLab(lab: LabResult): TimelineRow {
  const range =
    lab.reference_range_low != null || lab.reference_range_high != null
      ? ` (ref ${lab.reference_range_low ?? '-'}-${lab.reference_range_high ?? '-'}${lab.unit ? ' ' + lab.unit : ''})`
      : ''
  const valuePart =
    lab.value !== null
      ? `${lab.value}${lab.unit ? ' ' + lab.unit : ''}`
      : 'value not recorded'

  return {
    id: `lab:${lab.id}`,
    date: lab.date,
    kind: 'lab',
    title: lab.test_name,
    summary: `${valuePart}${range}`,
    specialty: specialtyForLab(lab.category),
    severity: severityForLabFlag(lab.flag),
    raw: { kind: 'lab', data: lab },
  }
}

function normalizeImaging(study: ImagingStudy): TimelineRow {
  return {
    id: `imaging:${study.id}`,
    date: study.study_date,
    kind: 'imaging',
    title: `${study.modality} ${study.body_part}`,
    summary: study.findings_summary || study.indication,
    specialty: specialtyForImaging(study.modality),
    severity: 'info',
    raw: { kind: 'imaging', data: study },
  }
}

function normalizeAppointment(apt: Appointment): TimelineRow {
  const titleParts: string[] = []
  if (apt.doctor_name) titleParts.push(apt.doctor_name)
  if (apt.specialty) titleParts.push(apt.specialty)
  const title = titleParts.length > 0 ? titleParts.join(' - ') : 'Appointment'

  return {
    id: `appointment:${apt.id}`,
    date: apt.date,
    kind: 'appointment',
    title,
    summary: apt.reason || apt.clinic,
    specialty: apt.specialty ?? null,
    severity: 'info',
    raw: { kind: 'appointment', data: apt },
  }
}

function normalizeEvent(event: MedicalTimelineEvent): TimelineRow {
  const severity: TimelineRow['severity'] =
    event.significance === 'critical'
      ? 'critical'
      : event.significance === 'important'
        ? 'watch'
        : 'info'
  return {
    id: `event:${event.id}`,
    date: event.event_date,
    kind: 'event',
    title: event.title,
    summary: event.description,
    // medical_timeline rows don't carry specialty; leave null so the filter
    // chip bar can group them into "Milestones" rather than a provider.
    specialty: null,
    severity,
    raw: { kind: 'event', data: event },
  }
}

function normalizeProblem(problem: ActiveProblemRow): TimelineRow {
  // Problems without an onset_date should still appear but sort to the bottom;
  // use the unix epoch as a safe-but-obvious fallback marker.
  const date = problem.onset_date ?? '1970-01-01'
  return {
    id: `problem:${problem.id}`,
    date,
    kind: 'problem',
    title: problem.problem,
    summary: problem.latest_data,
    specialty: null,
    severity: problem.status === 'investigating' ? 'watch' : 'info',
    raw: { kind: 'problem', data: problem },
  }
}

// ── Main merge ────────────────────────────────────────────────────────

export interface MergeInput {
  labs: LabResult[]
  imaging: ImagingStudy[]
  appointments: Appointment[]
  events: MedicalTimelineEvent[]
  problems: ActiveProblemRow[]
}

/**
 * Merge all record streams into a single chronologically sorted list,
 * newest first. Ties on the same date preserve the kind ordering so the
 * sort is stable (lab < imaging < appointment < event < problem).
 */
export function mergeTimeline(input: MergeInput): TimelineRow[] {
  const rows: TimelineRow[] = [
    ...input.labs.map(normalizeLab),
    ...input.imaging.map(normalizeImaging),
    ...input.appointments.map(normalizeAppointment),
    ...input.events.map(normalizeEvent),
    ...input.problems.map(normalizeProblem),
  ]

  const kindOrder: Record<TimelineKind, number> = {
    lab: 0,
    imaging: 1,
    appointment: 2,
    event: 3,
    problem: 4,
  }

  rows.sort((a, b) => {
    // Descending by date
    if (a.date !== b.date) return b.date.localeCompare(a.date)
    // Stable within a date: by kind, then by id
    if (a.kind !== b.kind) return kindOrder[a.kind] - kindOrder[b.kind]
    return a.id.localeCompare(b.id)
  })

  return rows
}

// ── Filter helpers ────────────────────────────────────────────────────

export type KindFilter = TimelineKind | 'all'

export interface TimelineFilterState {
  kind: KindFilter
  specialty: string | null // null = any specialty
}

/** Filter an already-merged timeline by kind + specialty. */
export function filterTimeline(
  rows: TimelineRow[],
  state: TimelineFilterState
): TimelineRow[] {
  return rows.filter((row) => {
    if (state.kind !== 'all' && row.kind !== state.kind) return false
    if (state.specialty && row.specialty !== state.specialty) return false
    return true
  })
}

/**
 * Collect the distinct specialties present in the data so the filter chip
 * bar can render only what actually exists (matches Guava's approach - no
 * phantom filters).
 */
export function availableSpecialties(rows: TimelineRow[]): string[] {
  const set = new Set<string>()
  for (const r of rows) {
    if (r.specialty) set.add(r.specialty)
  }
  return Array.from(set).sort()
}

// ── URL tab back-compat ───────────────────────────────────────────────

/**
 * Map a legacy `?tab=` query param onto a kind filter so the old tab URLs
 * keep working after the layout flip.
 */
export function kindFilterForTabParam(
  tabParam: string | null | undefined
): KindFilter {
  switch (tabParam) {
    case 'labs':
      return 'lab'
    case 'imaging':
      return 'imaging'
    case 'appointments':
      return 'appointment'
    case 'timeline':
      return 'event'
    default:
      return 'all'
  }
}
