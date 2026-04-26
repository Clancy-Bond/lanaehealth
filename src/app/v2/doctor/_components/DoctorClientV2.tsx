'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { Banner, Button, Card } from '@/v2/components/primitives'
import { SPECIALIST_CONFIG, type SpecialistView } from '@/lib/doctor/specialist-config'
import type { DoctorPageData } from '@/app/doctor/page'
import { useSpecialistView } from './useSpecialistView'
import { usePdfExport } from './usePdfExport'
import SpecialistToggleRow from './SpecialistToggleRow'
import RedFlagsSection from './RedFlagsSection'
import ExecutiveSummaryCard from './ExecutiveSummaryCard'
import TalkingPointsCard from './TalkingPointsCard'
import HypothesesCard from './HypothesesCard'
import DataFindingsCard from './DataFindingsCard'
import CIENextActionsCard from './CIENextActionsCard'
import OutstandingTestsCard from './OutstandingTestsCard'
import ChallengerCard from './ChallengerCard'
import CrossAppointmentCard from './CrossAppointmentCard'
import ResearchContextCard from './ResearchContextCard'
import WeeklyNarrativeCard from './WeeklyNarrativeCard'
import UpcomingAppointmentsCard from './UpcomingAppointmentsCard'
import SinceLastVisitCard from './SinceLastVisitCard'
import QuickTimelineCard from './QuickTimelineCard'
import MedicationDeltasCard from './MedicationDeltasCard'
import MedicationsAllergiesCard from './MedicationsAllergiesCard'
import CyclePhaseFindingsCard from './CyclePhaseFindingsCard'
import WrongModalityCard from './WrongModalityCard'
import StaleTestsCard from './StaleTestsCard'
import FollowThroughCard from './FollowThroughCard'
import CompletenessFooterCard from './CompletenessFooterCard'
import { bucketVisible } from '@/lib/doctor/specialist-config'

interface DoctorClientV2Props {
  data: DoctorPageData
  initialView: SpecialistView
  failureCount?: number
  totalQueries?: number
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
export default function DoctorClientV2({
  data,
  initialView,
  failureCount = 0,
  totalQueries = 0,
}: DoctorClientV2Props) {
  const { view, setView } = useSpecialistView(initialView)
  const { contentRef, exporting, printing, exportPdf } = usePdfExport()
  const config = SPECIALIST_CONFIG[view]
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const showFailureBanner = failureCount > 0 && totalQueries > 0

  return (
    <MobileShell
      top={
        <TopAppBar
          title="Doctor Mode"
          leading={
            <Link
              href="/v2"
              aria-label="Back to home"
              style={{
                color: 'var(--v2-text-secondary)',
                fontSize: 'var(--v2-text-base)',
                padding: 'var(--v2-space-2)',
                textDecoration: 'none',
                minHeight: 'var(--v2-touch-target-min)',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              ‹
            </Link>
          }
          trailing={
            <div style={{ display: 'flex', gap: 'var(--v2-space-2)', alignItems: 'center' }}>
              <Button
                variant="tertiary"
                size="sm"
                onClick={() => exportPdf()}
                disabled={exporting}
              >
                {exporting ? 'Exporting' : 'Export PDF'}
              </Button>
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
            </div>
          }
        />
      }
      bottom={null}
    >
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        <SpecialistToggleRow view={view} onChange={setView} />

        <div
          ref={contentRef}
          className={printing ? 'v2-surface-explanatory' : undefined}
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
          {/* Partial-failure notice. Sits above red flags so a doctor
              reading top-down learns immediately that something is
              missing before reading anything else. Visible degradation
              is the rule on a medical surface. */}
          {showFailureBanner && (
            <Banner
              intent="warning"
              title="Some sections could not load"
              body={`${failureCount} of ${totalQueries} data sources failed. The panels you see are still accurate. Tap retry below or refresh the page to try again.`}
              trailing={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => startRefresh(() => router.refresh())}
                  disabled={refreshing}
                >
                  {refreshing ? 'Retrying' : 'Retry'}
                </Button>
              }
            />
          )}

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

          {/* One-page printable handoff. Bearable's worksheet pattern:
              even doctors who do not open apps will look at one page.
              Keeps the screen-app workflow but unlocks the "fold it,
              hand it over" moment for any clinic. */}
          <Card padding="md">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
              <span
                style={{
                  fontSize: 'var(--v2-text-xs)',
                  color: 'var(--v2-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: 'var(--v2-tracking-wide)',
                  fontWeight: 'var(--v2-weight-medium)',
                }}
              >
                Print or hand off
              </span>
              <p
                style={{
                  margin: 0,
                  fontSize: 'var(--v2-text-sm)',
                  color: 'var(--v2-text-secondary)',
                  lineHeight: 'var(--v2-leading-relaxed)',
                }}
              >
                One page with identity, current meds, the 7-day numbers, and the top
                pattern. Print it, fold it, leave it on the desk.
              </p>
              <Link
                href="/v2/doctor/one-page"
                style={{
                  alignSelf: 'flex-start',
                  fontSize: 'var(--v2-text-sm)',
                  color: 'var(--v2-text-primary)',
                  textDecoration: 'underline',
                }}
              >
                Open the one-page handoff
              </Link>
            </div>
          </Card>

          {/* The single most important card: 7 pre-ranked things the
              doctor should hear first. See LEARNING-MODE HOOK D2 in
              useTalkingPoints.ts to tune the clinical priors. */}
          <TalkingPointsCard data={data} view={view} />

          <HypothesesCard data={data} view={view} />

          <CIENextActionsCard payload={data.kbActions} view={view} />

          <OutstandingTestsCard data={data} view={view} />

          <ChallengerCard payload={data.kbChallenger} />

          {/* PANEL-ORDER MARKER · FollowThroughCard would move here if
              prioritising the "what we agreed last time" opening. */}

          <UpcomingAppointmentsCard appointments={data.upcomingAppointments} />

          <CrossAppointmentCard data={data} view={view} />

          <SinceLastVisitCard data={data} />

          {bucketVisible(view, 'labs') && <DataFindingsCard data={data} view={view} />}

          {/* Phase-linked patterns are OB/GYN gold; bucket-gate them. */}
          {bucketVisible(view, 'cycle') && (
            <CyclePhaseFindingsCard findings={data.cyclePhaseFindings} />
          )}

          {/* Meds + allergies anchored before deltas: doctor needs the
              current regimen before reading "what changed and what
              shifted after." Same data lives on /v2/doctor/care-card
              for the printable summary, duplicated here for visit speed. */}
          <MedicationsAllergiesCard
            medications={data.medications}
            allergies={data.allergies}
          />

          <MedicationDeltasCard deltas={data.medicationDeltas} />

          {bucketVisible(view, 'imaging') && (
            <WrongModalityCard flags={data.wrongModalityFlags} />
          )}

          <QuickTimelineCard events={data.timelineEvents} />

          <StaleTestsCard tests={data.staleTests} />

          <Card>
            <h2
              style={{
                margin: 0,
                marginBottom: 'var(--v2-space-2)',
                fontSize: 'var(--v2-text-lg)',
                fontWeight: 'var(--v2-weight-semibold)',
                color: 'var(--v2-text-primary)',
                lineHeight: 'var(--v2-leading-normal)',
              }}
            >
              Test navigator
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-secondary)',
                lineHeight: 'var(--v2-leading-relaxed)',
              }}
            >
              Test-by-test playbook with PCP scripts, what to expect, common denial reasons, and
              counter-arguments. Reach for this when planning a visit or appealing a denied claim.
            </p>
            <div style={{ marginTop: 'var(--v2-space-3)' }}>
              <Link
                href="/v2/insurance/tests"
                style={{
                  display: 'block',
                  fontSize: 'var(--v2-text-sm)',
                  color: 'var(--v2-accent-primary)',
                  textDecoration: 'none',
                  padding: 'var(--v2-space-2) 0',
                }}
              >
                Open test navigator
              </Link>
            </div>
          </Card>

          <FollowThroughCard items={data.followThrough} />

          <WeeklyNarrativeCard view={view} />

          <ResearchContextCard payload={data.kbResearch} />

          <CompletenessFooterCard report={data.completeness} />
        </div>
      </div>
    </MobileShell>
  )
}
