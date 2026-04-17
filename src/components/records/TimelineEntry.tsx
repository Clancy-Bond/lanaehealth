'use client'

// TimelineEntry - polymorphic row for the unified medical records timeline.
// Renders one of: lab, imaging, appointment, timeline_event, active_problem.
//
// Design notes:
// - Inline lab entries may show a sparkline trend when >= 2 data points exist
//   for the same test_name. Sparkline uses the useRef width trick (NOT
//   ResponsiveContainer) per CLAUDE.md rule to avoid SSR zero-width bug on
//   Vercel.
// - Warm modern tokens only, no raw hex outside the specialty color map in
//   ProviderBadge.tsx.

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  CalendarDays,
  FileText,
  Monitor,
  AlertCircle,
  Stethoscope,
} from 'lucide-react'
import type {
  LabResult,
  LabFlag,
  ImagingStudy,
  Appointment,
  MedicalTimelineEvent,
  TimelineEventType,
} from '@/lib/types'
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts'
import { ProviderBadge, getProviderColor } from './ProviderBadge'

// ── Shared types ───────────────────────────────────────────────────────

// Minimal shape for active_problems rows we care about on the timeline.
// Mirrors the select list in /records/page.tsx.
export interface ActiveProblemRow {
  id: string
  problem: string
  status: string | null
  onset_date: string | null
  latest_data: string | null
}

export type UnifiedEntryKind =
  | 'lab'
  | 'imaging'
  | 'appointment'
  | 'event'
  | 'problem'

// Discriminated union so the renderer can narrow by kind.
export type UnifiedEntry =
  | { kind: 'lab'; date: string; id: string; data: LabResult }
  | { kind: 'imaging'; date: string; id: string; data: ImagingStudy }
  | { kind: 'appointment'; date: string; id: string; data: Appointment }
  | { kind: 'event'; date: string; id: string; data: MedicalTimelineEvent }
  | { kind: 'problem'; date: string; id: string; data: ActiveProblemRow }

// ── Flag styling (lab out-of-range stripe) ─────────────────────────────

interface FlagStyle {
  stripe: string
  chipBg: string
  chipFg: string
  label: string
}

function flagStyle(flag: LabFlag | null): FlagStyle | null {
  switch (flag) {
    case 'low':
      return {
        stripe: 'rgba(59, 130, 246, 0.45)',
        chipBg: 'rgba(59, 130, 246, 0.10)',
        chipFg: '#3B6FBF',
        label: 'Below range',
      }
    case 'high':
      return {
        stripe: 'rgba(217, 169, 78, 0.55)',
        chipBg: 'rgba(217, 169, 78, 0.14)',
        chipFg: '#9A7A2C',
        label: 'Above range',
      }
    case 'critical':
      return {
        stripe: 'rgba(212, 160, 160, 0.65)',
        chipBg: 'rgba(212, 160, 160, 0.18)',
        chipFg: '#8C5A5A',
        label: 'Watch closely',
      }
    case 'normal':
    default:
      return null
  }
}

// ── Event type color (mirrors TimelineTab) ─────────────────────────────

function eventColor(type: TimelineEventType): string {
  switch (type) {
    case 'diagnosis':
      return 'var(--event-diagnosis)'
    case 'symptom_onset':
      return 'var(--event-symptom)'
    case 'test':
      return 'var(--event-test)'
    case 'medication_change':
      return 'var(--event-medication)'
    case 'appointment':
      return 'var(--event-appointment)'
    case 'imaging':
      return 'var(--event-imaging)'
    case 'hospitalization':
      return 'var(--accent-blush)'
    default:
      return 'var(--text-muted)'
  }
}

function eventTypeLabel(type: TimelineEventType): string {
  switch (type) {
    case 'diagnosis':
      return 'Diagnosis'
    case 'symptom_onset':
      return 'Symptom'
    case 'test':
      return 'Test'
    case 'medication_change':
      return 'Medication'
    case 'appointment':
      return 'Appointment'
    case 'imaging':
      return 'Imaging'
    case 'hospitalization':
      return 'Hospital'
    default:
      return type
  }
}

function significanceBadge(
  sig: string | null | undefined,
): { label: string; bg: string; color: string } | null {
  switch (sig) {
    case 'critical':
      return { label: 'Watch closely', bg: 'rgba(212, 160, 160, 0.18)', color: '#8C5A5A' }
    case 'important':
      return { label: 'Important', bg: 'rgba(217, 169, 78, 0.14)', color: '#9A7A2C' }
    default:
      return null
  }
}

function problemStatusBadge(status: string | null): {
  label: string
  bg: string
  color: string
} | null {
  if (!status) return null
  switch (status) {
    case 'active':
      return { label: 'Active', bg: 'rgba(212, 160, 160, 0.18)', color: '#8C5A5A' }
    case 'investigating':
      return { label: 'Investigating', bg: 'rgba(217, 169, 78, 0.14)', color: '#9A7A2C' }
    case 'improving':
      return { label: 'Improving', bg: 'var(--accent-sage-muted)', color: 'var(--accent-sage)' }
    case 'resolved':
      return { label: 'Resolved', bg: 'var(--bg-elevated)', color: 'var(--text-muted)' }
    default:
      return null
  }
}

// ── Inline lab sparkline (useRef width trick, NOT ResponsiveContainer) ─

interface InlineSparklineProps {
  testName: string
  allResults: LabResult[]
}

function InlineSparkline({ testName, allResults }: InlineSparklineProps) {
  // Measure parent width after mount - ResponsiveContainer ships 0 width on
  // Vercel SSR and never re-renders. Per CLAUDE.md rule 16 (Recharts SSR).
  const chartRef = useRef<HTMLDivElement>(null)
  const [chartWidth, setChartWidth] = useState(0)

  useEffect(() => {
    const measure = () => {
      if (chartRef.current) {
        setChartWidth(chartRef.current.clientWidth)
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const trendData = useMemo(() => {
    return allResults
      .filter((r) => r.test_name === testName && r.value !== null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => {
        const d = new Date(r.date + 'T00:00:00')
        return {
          date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value: r.value as number,
          refLow: r.reference_range_low,
          refHigh: r.reference_range_high,
        }
      })
  }, [testName, allResults])

  if (trendData.length < 2) return null

  const refLow = trendData[0]?.refLow ?? undefined
  const refHigh = trendData[0]?.refHigh ?? undefined

  return (
    <div className="mt-3 rounded-xl p-3" style={{ background: 'var(--bg-elevated)' }}>
      <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
        {testName} trend ({trendData.length} points)
      </p>
      <div ref={chartRef} style={{ width: '100%', height: 110 }}>
        {chartWidth > 0 && (
          <LineChart
            width={chartWidth}
            height={110}
            data={trendData}
            margin={{ top: 4, right: 8, bottom: 0, left: -20 }}
          >
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            {refLow !== undefined && refLow !== null && (
              <ReferenceLine
                y={refLow}
                stroke="var(--text-muted)"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
            )}
            {refHigh !== undefined && refHigh !== null && (
              <ReferenceLine
                y={refHigh}
                stroke="var(--text-muted)"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
            )}
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--accent-sage)"
              strokeWidth={2}
              dot={{ fill: 'var(--accent-sage)', r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        )}
      </div>
    </div>
  )
}

// ── Date formatting ────────────────────────────────────────────────────

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ── Main renderer ──────────────────────────────────────────────────────

interface TimelineEntryProps {
  entry: UnifiedEntry
  // Optional ref data the lab renderer uses to draw an inline sparkline when
  // the same test appears >= 2 times across all lab rows. Keeps sparkline
  // lookup O(n) once per render without re-querying Supabase.
  allLabs?: LabResult[]
}

export function TimelineEntry({ entry, allLabs = [] }: TimelineEntryProps) {
  const [expanded, setExpanded] = useState(false)

  switch (entry.kind) {
    case 'lab': {
      const lab = entry.data
      const style = flagStyle(lab.flag)
      const outOfRange = !!style

      // Count same-test rows to decide whether to offer a trend toggle
      const sameTestCount = allLabs.filter(
        (r) => r.test_name === lab.test_name,
      ).length
      const canShowTrend = sameTestCount >= 2

      return (
        <div
          className="card p-4"
          style={
            outOfRange
              ? {
                  borderLeft: `3px solid ${style!.stripe}`,
                  boxShadow: 'var(--shadow-sm)',
                }
              : { boxShadow: 'var(--shadow-sm)' }
          }
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: 'var(--accent-sage-muted)',
                color: 'var(--accent-sage)',
              }}
            >
              <Activity size={11} aria-hidden="true" />
              Lab
            </span>
            {lab.category && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
              >
                {lab.category}
              </span>
            )}
            <span className="tabular text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
              {formatFullDate(lab.date)}
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between gap-3">
            <span
              className="text-sm font-medium flex-1 min-w-0 truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              {lab.test_name}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className="tabular text-sm font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {lab.value !== null ? lab.value : '-'}
                {lab.unit && (
                  <span
                    className="text-xs font-normal ml-1"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {lab.unit}
                  </span>
                )}
              </span>
              {style && (
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{ background: style.chipBg, color: style.chipFg }}
                >
                  {style.label}
                </span>
              )}
            </div>
          </div>

          {(lab.reference_range_low !== null || lab.reference_range_high !== null) && (
            <p className="tabular text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Ref {lab.reference_range_low ?? '-'} to {lab.reference_range_high ?? '-'}{' '}
              {lab.unit || ''}
            </p>
          )}

          {canShowTrend && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="touch-target press-feedback mt-1 text-xs font-medium rounded-md px-2 py-1"
              style={{
                color: 'var(--accent-sage)',
                background: expanded ? 'var(--accent-sage-muted)' : 'transparent',
                transition: `background var(--duration-fast) var(--ease-standard)`,
              }}
            >
              {expanded ? 'Hide trend' : 'Show trend'}
            </button>
          )}

          {expanded && canShowTrend && (
            <InlineSparkline testName={lab.test_name} allResults={allLabs} />
          )}
        </div>
      )
    }

    case 'imaging': {
      const study = entry.data
      const providerColor = getProviderColor('Imaging')
      return (
        <div
          className="card p-4"
          style={{
            boxShadow: 'var(--shadow-sm)',
            borderLeft: `3px solid ${providerColor}`,
          }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(6, 182, 212, 0.12)', color: '#06B6D4' }}
            >
              <Monitor size={11} aria-hidden="true" />
              {study.modality}
            </span>
            <span className="tabular text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
              {formatFullDate(study.study_date)}
            </span>
          </div>

          <button
            onClick={() => setExpanded((v) => !v)}
            className="press-feedback w-full text-left mt-2"
            aria-expanded={expanded}
          >
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {study.body_part}
            </p>
            {study.indication && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {study.indication}
              </p>
            )}
          </button>

          {expanded && (
            <div
              className="mt-3 space-y-2"
              style={{ borderTop: '1px solid var(--border-light)', paddingTop: '10px' }}
            >
              {study.findings_summary && (
                <div>
                  <p
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Findings summary
                  </p>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-primary)' }}>
                    {study.findings_summary}
                  </p>
                </div>
              )}
              <Link
                href={`/imaging?study=${study.id}`}
                onClick={(e) => e.stopPropagation()}
                className="press-feedback flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-medium"
                style={{
                  background: 'var(--accent-sage-muted)',
                  color: 'var(--accent-sage)',
                  border: '1px solid rgba(107, 144, 128, 0.2)',
                }}
              >
                <Monitor size={14} strokeWidth={2} />
                View in PACS viewer
              </Link>
            </div>
          )}
        </div>
      )
    }

    case 'appointment': {
      const apt = entry.data
      const providerColor = getProviderColor(apt.specialty)
      return (
        <div
          className="card p-4"
          style={{
            boxShadow: 'var(--shadow-sm)',
            borderLeft: `3px solid ${providerColor}`,
          }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
            >
              <CalendarDays size={11} aria-hidden="true" />
              Visit
            </span>
            {apt.specialty && <ProviderBadge specialty={apt.specialty} />}
            <span className="tabular text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
              {formatFullDate(apt.date)}
            </span>
          </div>

          <button
            onClick={() => setExpanded((v) => !v)}
            className="press-feedback w-full text-left mt-2"
            aria-expanded={expanded}
          >
            {apt.doctor_name && (
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {apt.doctor_name}
              </p>
            )}
            {apt.clinic && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {apt.clinic}
              </p>
            )}
            {apt.reason && !expanded && (
              <p
                className="text-xs mt-1 truncate"
                style={{ color: 'var(--text-secondary)' }}
              >
                {apt.reason}
              </p>
            )}
          </button>

          {expanded && (
            <div
              className="mt-3 space-y-2"
              style={{ borderTop: '1px solid var(--border-light)', paddingTop: '10px' }}
            >
              {apt.reason && (
                <div>
                  <p
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Reason
                  </p>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-primary)' }}>
                    {apt.reason}
                  </p>
                </div>
              )}
              {apt.notes && (
                <div>
                  <p
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Notes
                  </p>
                  <p
                    className="text-sm mt-0.5 whitespace-pre-wrap"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {apt.notes}
                  </p>
                </div>
              )}
              {apt.action_items && (
                <div>
                  <p
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Action items
                  </p>
                  <p
                    className="text-sm mt-0.5 whitespace-pre-wrap"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {apt.action_items}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )
    }

    case 'event': {
      const event = entry.data
      const color = eventColor(event.event_type)
      const sigBadge = significanceBadge(event.significance)
      return (
        <div
          className="card p-4"
          style={{
            boxShadow: 'var(--shadow-sm)',
            borderLeft: `3px solid ${color}`,
          }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: `${color}1A`, color }}
            >
              <FileText size={11} aria-hidden="true" />
              {eventTypeLabel(event.event_type)}
            </span>
            {sigBadge && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: sigBadge.bg, color: sigBadge.color }}
              >
                {sigBadge.label}
              </span>
            )}
            <span className="tabular text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
              {formatFullDate(event.event_date)}
            </span>
          </div>

          <button
            onClick={() => setExpanded((v) => !v)}
            className="press-feedback w-full text-left mt-2"
            aria-expanded={expanded}
          >
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {event.title}
            </p>
            {event.description && !expanded && (
              <p
                className="text-xs mt-1 truncate"
                style={{ color: 'var(--text-secondary)' }}
              >
                {event.description}
              </p>
            )}
          </button>

          {expanded && event.description && (
            <div
              className="mt-3 rounded-lg p-3"
              style={{ background: 'var(--bg-elevated)' }}
            >
              <p
                className="text-sm whitespace-pre-wrap"
                style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}
              >
                {event.description}
              </p>
            </div>
          )}
        </div>
      )
    }

    case 'problem': {
      const problem = entry.data
      const statusBadge = problemStatusBadge(problem.status)
      return (
        <div
          className="card p-4"
          style={{
            boxShadow: 'var(--shadow-sm)',
            borderLeft: '3px solid var(--accent-blush)',
          }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'var(--accent-blush-muted)', color: 'var(--accent-blush)' }}
            >
              <Stethoscope size={11} aria-hidden="true" />
              Active problem
            </span>
            {statusBadge && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: statusBadge.bg, color: statusBadge.color }}
              >
                {statusBadge.label}
              </span>
            )}
            {problem.onset_date && (
              <span
                className="tabular text-xs ml-auto"
                style={{ color: 'var(--text-muted)' }}
              >
                Since {formatFullDate(problem.onset_date)}
              </span>
            )}
          </div>

          <p className="text-sm font-medium mt-2" style={{ color: 'var(--text-primary)' }}>
            {problem.problem}
          </p>
          {problem.latest_data && (
            <p
              className="text-xs mt-1"
              style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}
            >
              {problem.latest_data}
            </p>
          )}
        </div>
      )
    }

    default: {
      // Narrowing exhaustiveness check. If a new kind is added without a case,
      // the assignment below will produce a TS error.
      const _exhaustive: never = entry
      void _exhaustive
      return (
        <div className="card p-4" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <AlertCircle size={14} aria-hidden="true" />
          Unknown entry
        </div>
      )
    }
  }
}

// ── Helpers exported for unit tests ────────────────────────────────────

/**
 * Merge all record sources into a unified chronological stream.
 * Sort is strictly by date descending. Ties break by kind stability order
 * (event > appointment > imaging > lab > problem) so clinically-significant
 * rows appear first within a day.
 */
export function buildUnifiedStream(args: {
  labs: LabResult[]
  imaging: ImagingStudy[]
  appointments: Appointment[]
  events: MedicalTimelineEvent[]
  problems: ActiveProblemRow[]
}): UnifiedEntry[] {
  const tierRank: Record<UnifiedEntryKind, number> = {
    event: 0,
    appointment: 1,
    imaging: 2,
    lab: 3,
    problem: 4,
  }

  const rows: UnifiedEntry[] = [
    ...args.labs.map<UnifiedEntry>((l) => ({
      kind: 'lab',
      date: l.date,
      id: l.id,
      data: l,
    })),
    ...args.imaging.map<UnifiedEntry>((s) => ({
      kind: 'imaging',
      date: s.study_date,
      id: s.id,
      data: s,
    })),
    ...args.appointments.map<UnifiedEntry>((a) => ({
      kind: 'appointment',
      date: a.date,
      id: a.id,
      data: a,
    })),
    ...args.events.map<UnifiedEntry>((e) => ({
      kind: 'event',
      date: e.event_date,
      id: e.id,
      data: e,
    })),
    // Problems without an onset date are placed at the very end (kind tier
    // does the work since date comparison becomes neutral for missing dates).
    ...args.problems.map<UnifiedEntry>((p) => ({
      kind: 'problem',
      // Use onset_date if present, else an "ancient" sentinel so problems
      // without onset sort to the bottom.
      date: p.onset_date ?? '1900-01-01',
      id: p.id,
      data: p,
    })),
  ]

  rows.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date)
    return tierRank[a.kind] - tierRank[b.kind]
  })

  return rows
}

/**
 * Group entries by month-year. Returns an ordered array (most recent first)
 * for use with sticky date headers in the timeline.
 */
export function groupByMonth(entries: UnifiedEntry[]): Array<{
  key: string
  label: string
  items: UnifiedEntry[]
}> {
  const buckets = new Map<string, UnifiedEntry[]>()
  for (const e of entries) {
    // Keys like "2026-04". Problems with the 1900 sentinel get a dedicated
    // "Ongoing" bucket so they are not surfaced as ancient rows.
    const isSentinel = e.kind === 'problem' && e.date === '1900-01-01'
    const key = isSentinel ? 'ongoing' : e.date.slice(0, 7)
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(e)
  }
  const sortedKeys = Array.from(buckets.keys()).sort((a, b) => {
    // Keep "ongoing" at the bottom
    if (a === 'ongoing') return 1
    if (b === 'ongoing') return -1
    return b.localeCompare(a)
  })
  return sortedKeys.map((key) => {
    let label: string
    if (key === 'ongoing') {
      label = 'Ongoing'
    } else {
      const [y, m] = key.split('-')
      const d = new Date(Number(y), Number(m) - 1, 1)
      label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }
    return { key, label, items: buckets.get(key)! }
  })
}

/**
 * Filter the unified stream by kind.
 */
export function filterByKind(
  entries: UnifiedEntry[],
  kind: UnifiedEntryKind | 'all',
): UnifiedEntry[] {
  if (kind === 'all') return entries
  return entries.filter((e) => e.kind === kind)
}
