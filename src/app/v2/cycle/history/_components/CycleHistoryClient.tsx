'use client'

/*
 * CycleHistoryClient
 *
 * Client-side glue for /v2/cycle/history. The server page pre-computes
 * a detail map keyed by date (one entry per day with menstruation, flow,
 * ovulation signs, LH tests, mucus, symptoms, temperature, notes, cycle
 * day, and phase). This component renders the calendar with a tap
 * handler, tracks which day is selected, and opens CycleDayDetailSheet.
 *
 * The server still owns the "completed cycles" card and the explanatory
 * block; those are passed through as children so the client file stays
 * focused on interactive behavior.
 */
import { useState } from 'react'
import { Card } from '@/v2/components/primitives'
import type { CycleEntry } from '@/lib/types'
import CycleCalendarGrid from '../../_components/CycleCalendarGrid'
import CycleDayDetailSheet, {
  type CycleDayDetail,
} from '../../_components/CycleDayDetailSheet'
import NCHistoryRail, { type NCHistoryRailGroup } from '@/v2/components/NCHistoryRail'

export interface CycleHistoryClientProps {
  today: string
  entries: CycleEntry[]
  predictedRangeStart: string | null
  predictedRangeEnd: string | null
  detailMap: Record<string, CycleDayDetail>
  /** Pre-grouped rows for the NC vertical timeline rail (frame_0080). */
  railGroups?: NCHistoryRailGroup[]
  /**
   * Confirmed-ovulation dates passed through to the calendar grid so
   * NC's egg-dot marker (frame_0150) can render below the right cells.
   */
  ovulationDates?: ReadonlyArray<string>
  /** Server-rendered completed cycles + explanatory blocks. */
  children?: React.ReactNode
}

export default function CycleHistoryClient({
  today,
  entries,
  predictedRangeStart,
  predictedRangeEnd,
  detailMap,
  railGroups,
  ovulationDates,
  children,
}: CycleHistoryClientProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const activeDetail: CycleDayDetail | null = selectedDate
    ? (detailMap[selectedDate] ?? {
        date: selectedDate,
        flow_level: null,
        menstruation: false,
        ovulation_signs: null,
        lh_test_result: null,
        cervical_mucus_consistency: null,
        cervical_mucus_quantity: null,
        symptoms: null,
        temp_f: null,
        temp_c: null,
        notes: null,
        cycleDay: null,
        phase: null,
      })
    : null

  return (
    <>
      {/* NC vertical timeline rail leads (frame_0080). The traditional
          calendar grid stays below as a secondary view since some users
          still want the month-at-a-glance context. */}
      {railGroups && railGroups.length > 0 && (
        <NCHistoryRail
          groups={railGroups}
          onPickDate={(date) => setSelectedDate(date)}
        />
      )}

      <Card padding="md">
        <CycleCalendarGrid
          entries={entries}
          today={today}
          predictedRangeStart={predictedRangeStart}
          predictedRangeEnd={predictedRangeEnd}
          onDayClick={(date) => setSelectedDate(date)}
          ovulationDates={ovulationDates}
        />
      </Card>

      {children}

      <CycleDayDetailSheet
        open={selectedDate !== null}
        onClose={() => setSelectedDate(null)}
        detail={activeDetail}
      />
    </>
  )
}
