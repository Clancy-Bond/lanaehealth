import { Card, ListRow } from '@/v2/components/primitives'
import DoctorPanelHeader from './DoctorPanelHeader'
import type { StaleTest } from '@/lib/doctor/stale-tests'

interface StaleTestsCardProps {
  tests: StaleTest[]
}

function severityIntent(severity: StaleTest['severity']): 'warning' | 'default' {
  return severity === 'urgent' || severity === 'overdue' ? 'warning' : 'default'
}

function severityLabel(severity: StaleTest['severity']): string {
  if (severity === 'urgent') return 'Urgent'
  if (severity === 'overdue') return 'Overdue'
  return 'Watch'
}

/*
 * StaleTestsCard
 *
 * Tests ordered but never resulted. These are the tests the doctor
 * thought were running in the background and probably assumes came
 * back clean. Surfacing them at a visit turns "we never checked"
 * into "we need to check."
 *
 * Safety-critical empty state: "no pending tests" is reassurance
 * worth showing explicitly. Silent collapse would leave the doctor
 * unsure whether the check ran.
 */
export default function StaleTestsCard({ tests }: StaleTestsCardProps) {
  if (tests.length === 0) {
    return (
      <Card padding="md">
        <DoctorPanelHeader
          title="Tests ordered but not resulted"
          summary="No tests pending - every order has a result on file."
        />
      </Card>
    )
  }
  const urgent = tests.filter((t) => t.severity === 'urgent').length
  const summary =
    urgent > 0
      ? `${urgent} urgent (${tests.length} total)`
      : `${tests.length} pending ${tests.length === 1 ? 'test' : 'tests'}`

  return (
    <Card padding="md">
      <DoctorPanelHeader title="Tests ordered but not resulted" summary={summary} />
      <div>
        {tests.map((t, i) => (
          <ListRow
            key={t.timelineEventId}
            label={t.testName}
            subtext={`${t.daysPending} days pending${t.orderedBy ? ` · ordered by ${t.orderedBy}` : ''}`}
            trailing={severityLabel(t.severity)}
            intent={severityIntent(t.severity)}
            divider={i !== tests.length - 1}
          />
        ))}
      </div>
    </Card>
  )
}
