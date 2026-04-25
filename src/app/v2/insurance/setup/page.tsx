/*
 * /v2/insurance/setup (server component shell)
 *
 * First-run picker. Loads the current insurance profile (if any) and
 * passes it to the client form so we can pre-fill on edits. Page is
 * also reachable from the hub via "Change plan" so it doubles as the
 * edit screen.
 */
import { getInsuranceProfile, INSURANCE_PLAN_DEFINITIONS } from '@/lib/api/insurance'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import BackChevron from '../_components/BackChevron'
import SetupForm from './_components/SetupForm'

export const dynamic = 'force-dynamic'

export default async function V2InsuranceSetupPage() {
  const profile = await getInsuranceProfile()

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="Pick your insurance"
          leading={<BackChevron href="/v2/insurance" label="Back to insurance hub" />}
        />
      }
    >
      <div
        style={{
          padding: 'var(--v2-space-4)',
          paddingBottom: 'var(--v2-space-8)',
        }}
      >
        <SetupForm
          definitions={INSURANCE_PLAN_DEFINITIONS}
          initialProfile={profile}
        />
      </div>
    </MobileShell>
  )
}
