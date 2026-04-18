'use client'

/**
 * TimelineEntry - polymorphic row renderer for the unified records timeline
 * (Wave 2c D1+F6). Given a TimelineRow it renders a compact header + the
 * kind-specific body (inline-expandable for labs/imaging/appointments).
 *
 * Labs preserve the Wave 2c D3 sparkline: when a test has 2+ historical
 * values, we mount an inline TrendSparkline on demand. The chart uses the
 * explicit useRef width pattern (NOT ResponsiveContainer) per the Vercel
 * SSR lesson recorded in CLAUDE.md.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { formatClinicName } from '@/lib/appointments/format'
import { Monitor } from 'lucide-react'
import { LineChart, Line, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts'
import type {
  Appointment,
  ImagingStudy,
  LabResult,
  MedicalTimelineEvent,
} from '@/lib/types'
import type {
  ActiveProblemRow,
  TimelineRow,
} from '@/lib/records/timeline-merge'
import { ProviderBadge } from './ProviderBadge'
import { InfoTip } from '@/components/ui/InfoTip'
import { getExplainer } from '@/lib/explainers/dictionary'

function tipSlugForLab(testName: string): string | null {
  if (!testName) return null;
  const raw = testName.toLowerCase().trim();
  if (getExplainer(raw)) return raw;
  const stripped = raw
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return getExplainer(stripped) ? stripped : null;
}

// ── Date helpers ──────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  if (dateStr === '1970-01-01') return 'Undated'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Lab-specific helpers (lifted from LabsTab so sparkline works inline) ─

interface LabFlagStyle {
  stripe: string
  chipBg: string
  chipFg: string
  label: string
}

function labFlagStyle(flag: string | null): LabFlagStyle | null {
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
    default:
      return null
  }
}

interface TrendSparklineProps {
  testName: string
  allLabs: LabResult[]
}

/**
 * Inline lab trend chart used when a user expands a lab row. Uses the
 * useRef width measurement pattern instead of ResponsiveContainer, which
 * breaks on Vercel SSR (width=0 on hydrate, never re-renders).
 */
function TrendSparkline({ testName, allLabs }: TrendSparklineProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)

  useEffect(() => {
    const measure = () => {
      if (ref.current) setW(ref.current.clientWidth)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const data = useMemo(() => {
    return allLabs
      .filter((r) => r.test_name === testName && r.value !== null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({
        date: formatShortDate(r.date),
        value: r.value as number,
        refLow: r.reference_range_low,
        refHigh: r.reference_range_high,
      }))
  }, [testName, allLabs])

  if (data.length < 2) return null

  const refLow = data[0]?.refLow ?? undefined
  const refHigh = data[0]?.refHigh ?? undefined

  return (
    <div
      className="mt-3 rounded-xl p-3"
      style={{ background: 'var(--bg-elevated)' }}
    >
      <p
        className="text-xs font-medium mb-2"
        style={{ color: 'var(--text-secondary)' }}
      >
        {testName} trend
      </p>
      <div ref={ref} style={{ width: '100%', height: 120 }}>
        {w > 0 && (
          <LineChart
            width={w}
            height={120}
            data={data}
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
            {refLow != null && (
              <ReferenceLine
                y={refLow}
                stroke="var(--text-muted)"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
            )}
            {refHigh != null && (
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

// ── Per-kind body renderers ───────────────────────────────────────────

function LabBody({
  lab,
  allLabs,
  trendEligible,
}: {
  lab: LabResult
  allLabs: LabResult[]
  trendEligible: Set<string>
}) {
  const style = labFlagStyle(lab.flag)
  const [showTrend, setShowTrend] = useState(false)
  const canTrend = trendEligible.has(lab.test_name)

  return (
    <div
      className="px-4 py-3 relative"
      style={
        style ? { borderLeft: `2px solid ${style.stripe}` } : undefined
      }
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className="text-sm font-medium flex-1 min-w-0"
          style={{ color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center' }}
        >
          <span className="truncate">{lab.test_name}</span>
          {tipSlugForLab(lab.test_name) && (
            <InfoTip term={tipSlugForLab(lab.test_name)!} />
          )}
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
          {style ? (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0"
              style={{ background: style.chipBg, color: style.chipFg }}
            >
              {style.label}
            </span>
          ) : (
            <span
              className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: 'var(--text-muted)', opacity: 0.45 }}
              aria-label="In range"
            />
          )}
        </div>
      </div>

      {(lab.reference_range_low !== null ||
        lab.reference_range_high !== null) && (
        <p
          className="tabular text-xs mt-0.5"
          style={{ color: 'var(--text-muted)' }}
        >
          Ref {lab.reference_range_low ?? '-'} to{' '}
          {lab.reference_range_high ?? '-'} {lab.unit || ''}
        </p>
      )}

      {canTrend && (
        <button
          onClick={() => setShowTrend((v) => !v)}
          className="touch-target press-feedback mt-1 text-xs font-medium rounded-md px-2 py-1"
          style={{
            color: 'var(--accent-sage)',
            background: showTrend ? 'var(--accent-sage-muted)' : 'transparent',
            transition: `background var(--duration-fast) var(--ease-standard)`,
          }}
        >
          {showTrend ? 'Hide trend' : 'Show trend'}
        </button>
      )}

      {showTrend && <TrendSparkline testName={lab.test_name} allLabs={allLabs} />}
    </div>
  )
}

function ImagingBody({
  study,
  title,
  summary,
  expanded,
  onToggle,
}: {
  study: ImagingStudy
  title: string
  summary: string | null
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <div className="px-4 py-3">
      <button
        onClick={onToggle}
        className="press-feedback w-full text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-medium truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              {title}
            </p>
            {summary && (
              <p
                className="text-xs mt-0.5 line-clamp-1"
                style={{ color: 'var(--text-muted)' }}
              >
                {summary}
              </p>
            )}
          </div>
          <svg
            className="w-4 h-4 shrink-0"
            style={{
              color: 'var(--text-muted)',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: `transform var(--duration-fast) var(--ease-standard)`,
            }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {expanded && (
        <div
          className="mt-3 space-y-3"
          style={{
            borderTop: '1px solid var(--border-light)',
            paddingTop: '12px',
          }}
        >
          {study.indication && (
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--text-muted)' }}
              >
                Indication
              </p>
              <p
                className="text-sm mt-0.5"
                style={{ color: 'var(--text-primary)' }}
              >
                {study.indication}
              </p>
            </div>
          )}
          {study.findings_summary && (
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--text-muted)' }}
              >
                Findings
              </p>
              <p
                className="text-sm mt-0.5"
                style={{ color: 'var(--text-primary)' }}
              >
                {study.findings_summary}
              </p>
            </div>
          )}
          {study.report_text && (
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--text-muted)' }}
              >
                Full report
              </p>
              <p
                className="text-sm mt-0.5 whitespace-pre-wrap"
                style={{
                  color: 'var(--text-secondary)',
                  lineHeight: '1.6',
                }}
              >
                {study.report_text}
              </p>
            </div>
          )}
          <Link
            href={`/imaging?study=${study.id}`}
            onClick={(e) => e.stopPropagation()}
            className="press-feedback flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium"
            style={{
              background: 'var(--accent-sage-muted)',
              color: 'var(--accent-sage)',
              border: '1px solid rgba(107, 144, 128, 0.2)',
            }}
          >
            <Monitor size={16} strokeWidth={2} />
            View in PACS viewer
          </Link>
        </div>
      )}
    </div>
  )
}

function AppointmentBody({
  apt,
  title,
  expanded,
  onToggle,
}: {
  apt: Appointment
  title: string
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <div className="px-4 py-3">
      <button
        onClick={onToggle}
        className="press-feedback w-full text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-medium truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              {title}
            </p>
            {formatClinicName(apt.clinic) && (
              <p
                className="text-xs mt-0.5 truncate"
                style={{ color: 'var(--text-muted)' }}
              >
                {formatClinicName(apt.clinic)}
              </p>
            )}
          </div>
          <svg
            className="w-4 h-4 shrink-0"
            style={{
              color: 'var(--text-muted)',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: `transform var(--duration-fast) var(--ease-standard)`,
            }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>
      {expanded && (
        <div
          className="mt-3 space-y-2"
          style={{
            borderTop: '1px solid var(--border-light)',
            paddingTop: '12px',
          }}
        >
          {apt.reason && (
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--text-muted)' }}
              >
                Reason
              </p>
              <p
                className="text-sm mt-0.5"
                style={{ color: 'var(--text-primary)' }}
              >
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

function EventBody({
  event,
  expanded,
  onToggle,
}: {
  event: MedicalTimelineEvent
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <div className="px-4 py-3">
      <button
        onClick={onToggle}
        className="press-feedback w-full text-left"
        aria-expanded={expanded}
      >
        <p
          className="text-sm font-medium"
          style={{ color: 'var(--text-primary)' }}
        >
          {event.title}
        </p>
        {event.description && !expanded && (
          <p
            className="text-xs mt-0.5 line-clamp-1"
            style={{ color: 'var(--text-muted)' }}
          >
            {event.description}
          </p>
        )}
      </button>
      {expanded && event.description && (
        <div
          className="mt-2 rounded-lg p-3"
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

function ProblemBody({ problem }: { problem: ActiveProblemRow }) {
  return (
    <div className="px-4 py-3">
      <p
        className="text-sm font-medium"
        style={{ color: 'var(--text-primary)' }}
      >
        {problem.problem}
      </p>
      {problem.latest_data && (
        <p
          className="text-xs mt-0.5"
          style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}
        >
          {problem.latest_data}
        </p>
      )}
    </div>
  )
}

// ── Top-level component ──────────────────────────────────────────────

interface TimelineEntryProps {
  row: TimelineRow
  /**
   * All labs, needed for the trend sparkline (cross-row lookup by test name).
   * Only used when row.kind === 'lab'.
   */
  allLabs: LabResult[]
  /** Set of test names with 2+ historical values (sparkline-eligible). */
  trendEligible: Set<string>
}

export function TimelineEntry({
  row,
  allLabs,
  trendEligible,
}: TimelineEntryProps) {
  const [expanded, setExpanded] = useState(false)
  const toggle = () => setExpanded((v) => !v)

  return (
    <div
      className="card overflow-hidden"
      id={`row-${row.id}`}
      data-kind={row.kind}
    >
      {/* Header strip with date + kind icon + specialty chip */}
      <div
        className="flex items-center gap-2 px-4 pt-3"
        style={{ color: 'var(--text-muted)' }}
      >
        <span className="tabular text-[11px] font-semibold uppercase tracking-wide">
          {formatDate(row.date)}
        </span>
        <span
          className="inline-block h-px flex-1"
          style={{ background: 'var(--border-light)' }}
        />
        {row.specialty && <ProviderBadge specialty={row.specialty} size="xs" />}
      </div>

      {row.raw.kind === 'lab' && (
        <LabBody
          lab={row.raw.data}
          allLabs={allLabs}
          trendEligible={trendEligible}
        />
      )}
      {row.raw.kind === 'imaging' && (
        <ImagingBody
          study={row.raw.data}
          title={row.title}
          summary={row.summary}
          expanded={expanded}
          onToggle={toggle}
        />
      )}
      {row.raw.kind === 'appointment' && (
        <AppointmentBody
          apt={row.raw.data}
          title={row.title}
          expanded={expanded}
          onToggle={toggle}
        />
      )}
      {row.raw.kind === 'event' && (
        <EventBody
          event={row.raw.data}
          expanded={expanded}
          onToggle={toggle}
        />
      )}
      {row.raw.kind === 'problem' && (
        <ProblemBody problem={row.raw.data} />
      )}
    </div>
  )
}
