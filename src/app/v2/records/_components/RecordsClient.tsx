'use client'

/*
 * RecordsClient (v2 records)
 *
 * Single client component that owns:
 *   - kind filter (All / Labs / Imaging / Appointments / Milestones / Problems)
 *   - specialty filter (from availableSpecialties)
 *   - search query (substring over title + summary + specialty)
 *
 * Receives the already-merged TimelineRow[] from the server page (so the
 * server pays the Supabase round-trip once). Re-filters client-side on
 * every keystroke or chip tap; groups the filtered rows by month and
 * hands them to TimelineGroup.
 *
 * Legacy /records?tab=labs|imaging|appointments|timeline URLs are still
 * honored via kindFilterForTabParam() seeding the initial kind filter.
 */

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  availableSpecialties,
  filterTimeline,
  kindFilterForTabParam,
  type KindFilter,
  type TimelineRow,
} from '@/lib/records/timeline-merge'
import { EmptyState } from '@/v2/components/primitives'
import RecordsFilterBar from './RecordsFilterBar'
import RecordsSearch from './RecordsSearch'
import TimelineGroup from './TimelineGroup'

interface MonthGroup {
  key: string
  label: string
  rows: TimelineRow[]
}

function groupByMonth(rows: TimelineRow[]): MonthGroup[] {
  const groups: MonthGroup[] = []
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

export interface RecordsClientProps {
  rows: TimelineRow[]
}

export default function RecordsClient({ rows }: RecordsClientProps) {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')

  const [kind, setKind] = useState<KindFilter>(() => kindFilterForTabParam(tabParam))
  const [specialty, setSpecialty] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  // Keep the filter in sync if the ?tab= param changes after mount (e.g.
  // a same-tab link from another v2 surface). The legacy page does this
  // too; mirror the behavior so back-compat feels consistent.
  useEffect(() => {
    setKind(kindFilterForTabParam(tabParam))
  }, [tabParam])

  const kindCounts = useMemo<Record<KindFilter, number>>(() => {
    const base: Record<KindFilter, number> = {
      all: rows.length,
      lab: 0,
      imaging: 0,
      appointment: 0,
      event: 0,
      problem: 0,
    }
    for (const r of rows) base[r.kind] += 1
    return base
  }, [rows])

  const specialties = useMemo(() => availableSpecialties(rows), [rows])

  const filtered = useMemo(() => {
    const withFacets = filterTimeline(rows, { kind, specialty })
    const q = query.trim().toLowerCase()
    if (!q) return withFacets
    return withFacets.filter((r) => {
      if (r.title.toLowerCase().includes(q)) return true
      if (r.summary && r.summary.toLowerCase().includes(q)) return true
      if (r.specialty && r.specialty.toLowerCase().includes(q)) return true
      return false
    })
  }, [rows, kind, specialty, query])

  const grouped = useMemo(() => groupByMonth(filtered), [filtered])

  const hasAnyRecords = rows.length > 0
  const hasFilteredResults = filtered.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
      <RecordsSearch value={query} onChange={setQuery} />
      <RecordsFilterBar
        kind={kind}
        specialty={specialty}
        kindCounts={kindCounts}
        availableSpecialties={specialties}
        onKindChange={setKind}
        onSpecialtyChange={setSpecialty}
      />

      {!hasAnyRecords && (
        <EmptyState
          illustration="🗂"
          headline="Your timeline is empty"
          subtext="Nothing to show yet. Import labs, log an appointment, or add imaging to see your timeline here."
        />
      )}

      {hasAnyRecords && !hasFilteredResults && (
        <EmptyState
          illustration="🔍"
          headline="No records match these filters"
          subtext="Try clearing the search or switching back to All."
        />
      )}

      {hasFilteredResults && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-5)' }}>
          {grouped.map((g) => (
            <TimelineGroup key={g.key} label={g.label} rows={g.rows} />
          ))}
        </div>
      )}
    </div>
  )
}
