'use client'

import { useMemo } from 'react'
import { Card, ListRow } from '@/v2/components/primitives'
import DoctorPanelHeader from './DoctorPanelHeader'
import { findOutstanding, sortByUrgency } from '@/lib/doctor/outstanding-tests'
import type { DoctorPageData } from '@/app/doctor/page'
import type { SpecialistView } from '@/lib/doctor/specialist-config'

interface OutstandingTestsCardProps {
  data: DoctorPageData
  view: SpecialistView
}

function urgencyLabel(u: 'high' | 'medium' | 'low'): string {
  if (u === 'high') return 'Order today'
  if (u === 'medium') return 'Within weeks'
  return 'When convenient'
}

function urgencyIntent(u: 'high' | 'medium' | 'low'): 'warning' | 'default' {
  return u === 'high' ? 'warning' : 'default'
}

/*
 * OutstandingTestsCard
 *
 * Tests we'd expect to have been ordered by now given the active
 * suspected conditions but that aren't on the labs list. A doctor
 * looking at "MRI brain with contrast not on record" for an active
 * POTS workup catches a gap that would otherwise run for months.
 */
export default function OutstandingTestsCard({ data, view }: OutstandingTestsCardProps) {
  const tests = useMemo(() => sortByUrgency(findOutstanding(data, view)).slice(0, 6), [data, view])
  if (tests.length === 0) return null
  const high = tests.filter((t) => t.urgency === 'high').length
  const summary =
    high > 0
      ? `${high} test${high === 1 ? '' : 's'} to order today`
      : `${tests.length} test${tests.length === 1 ? '' : 's'} to consider`

  return (
    <Card padding="md">
      <DoctorPanelHeader title="Tests worth ordering" summary={summary} />
      <div>
        {tests.map((t, i) => (
          <ListRow
            key={t.testName}
            label={t.testName}
            subtext={`Clarifies ${t.clarifies} · ${t.rationale}`}
            trailing={urgencyLabel(t.urgency)}
            intent={urgencyIntent(t.urgency)}
            divider={i !== tests.length - 1}
          />
        ))}
      </div>
    </Card>
  )
}
