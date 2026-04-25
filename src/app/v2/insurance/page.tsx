/*
 * /v2/insurance (server component)
 *
 * The insurance navigator hub. Three states:
 *
 *   1. No profile saved -> route the user to /v2/insurance/setup so
 *      we never render an empty hub. The setup page is the first-run.
 *   2. Profile saved with a content page (e.g. HMSA QUEST) -> show
 *      a quick-reference card + jump links to the plan page, the
 *      PCP explainer, and the strategies page.
 *   3. Profile saved on a plan we have no content for yet -> show a
 *      gentle banner pointing at the universal pages (PCP explainer,
 *      strategies). The hub still works.
 *
 * Voice: NC short and kind. No "you should" phrasing. The whole
 * navigator is opt-in and reads as "here's how to navigate the
 * doctor world", not "do these tasks".
 *
 * Sources cited inline in the rendered copy via the strategies +
 * hmsa-quest pages. See docs/research/insurance-navigator-research.md.
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getInsuranceProfile, getPlanDefinition } from '@/lib/api/insurance'
import { Card, ListRow } from '@/v2/components/primitives'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import BackChevron from './_components/BackChevron'
import SectionHeading from './_components/SectionHeading'

export const dynamic = 'force-dynamic'

export default async function V2InsuranceHubPage() {
  const profile = await getInsuranceProfile()
  if (!profile) {
    redirect('/v2/insurance/setup')
  }

  const plan = getPlanDefinition(profile.planSlug)

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="Insurance"
          leading={<BackChevron href="/v2/settings" label="Back to settings" />}
        />
      }
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-4)',
          padding: 'var(--v2-space-4)',
          paddingBottom: 'var(--v2-space-8)',
        }}
      >
        <Card>
          <SectionHeading level="h2">Your plan</SectionHeading>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-base)',
              color: 'var(--v2-text-primary)',
              fontWeight: 'var(--v2-weight-medium)',
            }}
          >
            {plan.label}
          </p>
          <p
            style={{
              margin: 'var(--v2-space-2) 0 0',
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            {plan.description}
          </p>
          {profile.memberId && (
            <p
              style={{
                margin: 'var(--v2-space-3) 0 0',
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-muted)',
              }}
            >
              Member ID: {profile.memberId}
            </p>
          )}
          <div style={{ marginTop: 'var(--v2-space-3)' }}>
            <Link
              href="/v2/insurance/setup"
              style={{
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-accent-primary)',
                textDecoration: 'none',
              }}
            >
              Change plan or update member ID
            </Link>
          </div>
        </Card>

        <Card>
          <SectionHeading level="h2">Navigate your care</SectionHeading>
          <div>
            {plan.hasContentPage && (
              <Link
                href={`/v2/insurance/${plan.slug}`}
                style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
              >
                <ListRow
                  label={`${plan.label} guide`}
                  subtext="Coverage, referrals, appeals, and telehealth."
                  chevron
                />
              </Link>
            )}
            <Link
              href="/v2/insurance/pcp-explainer"
              style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
            >
              <ListRow
                label="What a PCP actually does"
                subtext="The gatekeeper role, and how to ask for a specialist referral."
                chevron
              />
            </Link>
            <Link
              href="/v2/insurance/strategies"
              style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
            >
              <ListRow
                label="How to make your visit count"
                subtext="Visit prep, scripts, and what to do if you feel dismissed."
                chevron
                divider={false}
              />
            </Link>
          </div>
        </Card>

        {!plan.hasContentPage && (
          <Card>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-secondary)',
                lineHeight: 'var(--v2-leading-relaxed)',
              }}
            >
              We have not built a dedicated guide for {plan.label} yet. The
              PCP explainer and strategies pages above apply across plans.
            </p>
          </Card>
        )}
      </div>
    </MobileShell>
  )
}
