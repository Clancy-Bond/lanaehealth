'use client'

import Link from 'next/link'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { Button, Card } from '@/v2/components/primitives'
import { SPECIALIST_CONFIG, type SpecialistView } from '@/lib/doctor/specialist-config'
import type { DoctorPageData } from '@/app/doctor/page'
import { useSpecialistView } from './useSpecialistView'
import DoctorPanelHeader from './DoctorPanelHeader'
import SpecialistToggleRow from './SpecialistToggleRow'
import RedFlagsSection from './RedFlagsSection'
import ExecutiveSummaryCard from './ExecutiveSummaryCard'
import TalkingPointsCard from './TalkingPointsCard'
import UpcomingAppointmentsCard from './UpcomingAppointmentsCard'
import SinceLastVisitCard from './SinceLastVisitCard'
import QuickTimelineCard from './QuickTimelineCard'
import MedicationDeltasCard from './MedicationDeltasCard'
import CyclePhaseFindingsCard from './CyclePhaseFindingsCard'
import WrongModalityCard from './WrongModalityCard'
import StaleTestsCard from './StaleTestsCard'
import FollowThroughCard from './FollowThroughCard'
import CompletenessFooterCard from './CompletenessFooterCard'
import { bucketVisible } from '@/lib/doctor/specialist-config'

interface DoctorClientV2Props {
  data: DoctorPageData
  initialView: SpecialistView
}

/*
 * DoctorClientV2
 *
 * The doctor-visit briefing. Renders one long, scrollable page: scan
 * top-to-bottom, nothing hidden behind tabs or accordions. The bottom
 * nav is suppressed (MobileShell bottom={null}) so the surface feels
 * dedicated — a doctor using this during a visit should not trip
 * navigation by accident.
 *
 * LEARNING-MODE HOOK D1 — Panel ordering.
 *
 * Below, the default order goes: red flags, specialist-toggle,
 * the opening vitals card, the next-appointment card, then the
 * concern-surfacing panels (stale tests, follow-through), with the
 * data-completeness footnote at the bottom. A reasonable alternative
 * is to put follow-through right after the exec summary — "here is
 * what we agreed last time, here is what you actually did" is how
 * most real visits open.
 *
 * If you want that order, swap the FollowThroughCard block to come
 * directly after ExecutiveSummaryCard. See the comment markers inside
 * the content region.
 */
export default function DoctorClientV2({ data, initialView }: DoctorClientV2Props) {
  const { view, setView } = useSpecialistView(initialView)
  const config = SPECIALIST_CONFIG[view]

  return (
    <MobileShell
      top={
        <TopAppBar
          title="Doctor Mode"
          trailing={
            <Link
              href="/doctor"
              style={{
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-secondary)',
                textDecoration: 'none',
                padding: 'var(--v2-space-2)',
              }}
            >
              Legacy
            </Link>
          }
        />
      }
      bottom={null}
    >
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        <SpecialistToggleRow view={view} onChange={setView} />

        <div
          style={{
            maxWidth: 860,
            width: '100%',
            margin: '0 auto',
            padding: 'var(--v2-space-4)',
            paddingBottom: 'var(--v2-space-8)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-4)',
          }}
        >
          {/* Red flags always first, always distinct */}
          <RedFlagsSection flags={data.redFlags} />

          {/* Specialist-specific opening line */}
          <Card padding="md" variant="explanatory">
            <p
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-base)',
                lineHeight: 'var(--v2-leading-relaxed)',
                fontWeight: 'var(--v2-weight-medium)',
              }}
            >
              {config.openingLine}
            </p>
          </Card>

          {/* 30-second read: who, headline vitals, count of abnormals */}
          <ExecutiveSummaryCard data={data} view={view} />

          {/* The single most important card: 7 pre-ranked things the
              doctor should hear first. See LEARNING-MODE HOOK D2 in
              useTalkingPoints.ts to tune the clinical priors. */}
          <TalkingPointsCard data={data} view={view} />

          {/* PANEL-ORDER MARKER · FollowThroughCard would move here if
              prioritising the "what we agreed last time" opening. */}

          <UpcomingAppointmentsCard appointments={data.upcomingAppointments} />

          <SinceLastVisitCard data={data} />

          {/* Phase-linked patterns are OB/GYN gold; bucket-gate them. */}
          {bucketVisible(view, 'cycle') && (
            <CyclePhaseFindingsCard findings={data.cyclePhaseFindings} />
          )}

          <MedicationDeltasCard deltas={data.medicationDeltas} />

          {bucketVisible(view, 'imaging') && (
            <WrongModalityCard flags={data.wrongModalityFlags} />
          )}

          <QuickTimelineCard events={data.timelineEvents} />

          <StaleTestsCard tests={data.staleTests} />

          <FollowThroughCard items={data.followThrough} />

          {/* TODO (Phase C): HypothesesCard, DataFindingsCard,
              OutstandingTestsCard, CIENextActionsCard, ChallengerCard,
              ResearchContextCard, CrossAppointmentCard, WeeklyNarrativeCard.
              Plus PDF export via usePdfExport. */}
          <Card padding="md" style={{ borderStyle: 'dashed' }}>
            <DoctorPanelHeader
              title="More panels coming in Phase C"
              summary="Hypotheses, lab trends chart, outstanding tests, next actions, and 4 more"
            />
            <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-muted)' }}>
              This slot is a placeholder during the staged rollout. The
              legacy surface at{' '}
              <Link href={`/doctor?v=${view}`} style={{ color: 'var(--v2-accent-primary)' }}>
                /doctor
              </Link>{' '}
              still renders every panel.
            </p>
          </Card>

          <CompletenessFooterCard report={data.completeness} />

          {/* Export actions — PDF export wires up in Phase C */}
          <div style={{ display: 'flex', gap: 'var(--v2-space-2)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Button variant="secondary" size="md" disabled>
              Export PDF (Phase D)
            </Button>
          </div>
        </div>
      </div>
    </MobileShell>
  )
}
