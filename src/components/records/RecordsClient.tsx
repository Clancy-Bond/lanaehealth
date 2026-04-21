'use client'

/**
 * RecordsClient - Wave 2c D1+F6 unified chronological timeline.
 *
 * Replaces the previous 4-tab (Overview / Labs / Imaging / Timeline) layout
 * with one vertical scroll of every record type interleaved by date. Filter
 * chips at the top gate by kind (labs/imaging/appointments/milestones/problems)
 * and by provider specialty.
 *
 * Back-compat: legacy ?tab=labs|imaging|appointments|timeline URLs are honored
 * by mapping the tab param to the matching kind filter on mount.
 */

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import type {
  Appointment,
  ImagingStudy,
  LabResult,
  MedicalTimelineEvent,
} from '@/lib/types'
import {
  availableSpecialties,
  filterTimeline,
  kindFilterForTabParam,
  mergeTimeline,
  type ActiveProblemRow,
  type KindFilter,
  type TimelineRow,
} from '@/lib/records/timeline-merge'
import { ScrollToTop } from '@/components/ScrollToTop'
import { FilterChipBar } from './FilterChipBar'
import { LabActionBar } from './LabActionBar'
import { TimelineEntry } from './TimelineEntry'

interface RecordsClientProps {
  labs: LabResult[]
  imaging: ImagingStudy[]
  appointments: Appointment[]
  timeline: MedicalTimelineEvent[]
  problems: ActiveProblemRow[]
}

function groupByMonth(
  rows: TimelineRow[]
): { key: string; label: string; rows: TimelineRow[] }[] {
  const groups: { key: string; label: string; rows: TimelineRow[] }[] = []
  const index = new Map<string, number>()
  for (const row of rows) {
    const key = row.date === '1970-01-01' ? 'undated' : row.date.slice(0, 7)
    if (!index.has(key)) {
      const label =
        key === 'undated'
          ? 'Undated'
          : new Date(key + '-01T00:00:00').toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            })
      index.set(key, groups.length)
      groups.push({ key, label, rows: [] })
    }
    groups[index.get(key)!].rows.push(row)
  }
  return groups
}

export function RecordsClient({
  labs,
  imaging,
  appointments,
  timeline,
  problems,
}: RecordsClientProps) {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')

  const [kind, setKind] = useState<KindFilter>(() =>
    kindFilterForTabParam(tabParam)
  )
  const [specialty, setSpecialty] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    setKind(kindFilterForTabParam(tabParam))
  }, [tabParam])

  const merged = useMemo(
    () =>
      mergeTimeline({
        labs,
        imaging,
        appointments,
        events: timeline,
        problems,
      }),
    [labs, imaging, appointments, timeline, problems]
  )

  const kindCounts = useMemo<Record<KindFilter, number>>(() => {
    const base: Record<KindFilter, number> = {
      all: merged.length,
      lab: 0,
      imaging: 0,
      appointment: 0,
      event: 0,
      problem: 0,
    }
    for (const r of merged) base[r.kind] += 1
    return base
  }, [merged])

  const specialties = useMemo(() => availableSpecialties(merged), [merged])

  const trendEligible = useMemo(() => {
    const dateCounts: Record<string, Set<string>> = {}
    for (const lab of labs) {
      if (!dateCounts[lab.test_name]) dateCounts[lab.test_name] = new Set()
      dateCounts[lab.test_name].add(lab.date)
    }
    const eligible = new Set<string>()
    for (const [name, dates] of Object.entries(dateCounts)) {
      if (dates.size >= 2) eligible.add(name)
    }
    return eligible
  }, [labs])

  const filtered = useMemo(() => {
    const withFacets = filterTimeline(merged, { kind, specialty })
    const q = query.trim().toLowerCase()
    if (!q) return withFacets
    return withFacets.filter((r) => {
      if (r.title.toLowerCase().includes(q)) return true
      if (r.summary && r.summary.toLowerCase().includes(q)) return true
      if (r.specialty && r.specialty.toLowerCase().includes(q)) return true
      return false
    })
  }, [merged, kind, specialty, query])

  const grouped = useMemo(() => groupByMonth(filtered), [filtered])

  return (
    <div className="mt-4 space-y-4">
      <div className="space-y-3">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--text-muted)' }}
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search labs, imaging, appointments, milestones"
            aria-label="Search your records"
            className="w-full rounded-xl pl-9 pr-3 py-2.5 text-sm"
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
        <FilterChipBar
          kind={kind}
          specialty={specialty}
          onKindChange={(k) => setKind(k)}
          onSpecialtyChange={(s) => setSpecialty(s)}
          kindCounts={kindCounts}
          availableSpecialties={specialties}
        />
      </div>

      {kind === 'lab' && <LabActionBar />}

      {filtered.length === 0 && (
        <div className="empty-state">
          <Search className="empty-state__icon" strokeWidth={1.5} aria-hidden="true" />
          <p className="empty-state__title">No records match these filters</p>
          <p className="empty-state__hint">
            Try clearing the search or switching back to &quot;All&quot;.
          </p>
        </div>
      )}

      {grouped.map(({ key, label, rows }) => (
        <section key={key} aria-label={label} className="space-y-3">
          <div
            className="flex items-center gap-2 sticky top-0 z-10 py-1.5"
            style={{ background: 'var(--bg-primary)' }}
          >
            <span
              className="tabular text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--text-muted)' }}
            >
              {label}
            </span>
            <span
              className="h-px flex-1"
              style={{ background: 'var(--border-light)' }}
            />
          </div>
          <div className="space-y-3">
            {rows.map((row) => (
              <TimelineEntry
                key={row.id}
                row={row}
                allLabs={labs}
                trendEligible={trendEligible}
              />
            ))}
          </div>
        </section>
      ))}

      <ScrollToTop />
    </div>
  )
}
