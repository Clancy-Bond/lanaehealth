/*
 * /v2/insurance (server component)
 *
 * The insurance navigator hub. Three states, all rendered together:
 *
 *   1. "Your plan" card. If a plan is saved, deep-link to its
 *      dedicated guide (or to setup if no content page exists).
 *      If no plan is saved, gentle prompt to pick one.
 *   2. "Browse all carriers" card. Searchable + grouped list of
 *      every carrier in INSURANCE_PLAN_DEFINITIONS that has a
 *      content page. The user can always navigate to a guide
 *      regardless of whether they have a profile saved.
 *   3. "Universal navigator pages" card (PCP explainer + visit
 *      strategies) for cross-carrier basics.
 *
 * Voice: NC short and kind. No "you should" phrasing. The whole
 * navigator is opt-in and reads as "here is how to navigate the
 * doctor world", not "do these tasks".
 *
 * Foundation primitives untouched (Card, ListRow). All data comes
 * from src/lib/api/insurance.ts.
 *
 * No em-dashes anywhere in this file.
 */
import { getInsuranceProfile, getPlanDefinition } from '@/lib/api/insurance'
import { Card } from '@/v2/components/primitives'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import BackChevron from './_components/BackChevron'
import CarrierBrowser from './_components/CarrierBrowser'
import SectionHeading from './_components/SectionHeading'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function V2InsuranceHubPage() {
  const profile = await getInsuranceProfile()
  const plan = profile ? getPlanDefinition(profile.planSlug) : null

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
        {/* 1. Saved plan or prompt to pick */}
        {plan ? (
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
            {profile?.memberId && (
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
            <div
              style={{
                marginTop: 'var(--v2-space-3)',
                display: 'flex',
                gap: 'var(--v2-space-3)',
                flexWrap: 'wrap',
              }}
            >
              {plan.hasContentPage && (
                <Link
                  href={`/v2/insurance/${plan.slug}`}
                  style={{
                    fontSize: 'var(--v2-text-sm)',
                    color: 'var(--v2-accent-primary)',
                    textDecoration: 'none',
                    fontWeight: 'var(--v2-weight-medium)',
                  }}
                >
                  Open my guide
                </Link>
              )}
              <Link
                href="/v2/insurance/setup"
                style={{
                  fontSize: 'var(--v2-text-sm)',
                  color: 'var(--v2-text-secondary)',
                  textDecoration: 'none',
                }}
              >
                Change plan or update member ID
              </Link>
            </div>
          </Card>
        ) : (
          <Card>
            <SectionHeading level="h2">Pick your insurance</SectionHeading>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-secondary)',
                lineHeight: 'var(--v2-leading-relaxed)',
              }}
            >
              Saving your plan lets the hub deep-link straight to your guide
              and helps the AI chat tailor advice to your carrier. You can
              also browse any carrier below without saving anything.
            </p>
            <div style={{ marginTop: 'var(--v2-space-3)' }}>
              <Link
                href="/v2/insurance/setup"
                style={{
                  fontSize: 'var(--v2-text-sm)',
                  color: 'var(--v2-accent-primary)',
                  textDecoration: 'none',
                  fontWeight: 'var(--v2-weight-medium)',
                  minHeight: 'var(--v2-touch-target-min)',
                  paddingInline: 'var(--v2-space-3)',
                  paddingBlock: 'var(--v2-space-2)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  borderRadius: 'var(--v2-radius-md)',
                  background: 'var(--v2-accent-primary-soft)',
                }}
              >
                Save my plan
              </Link>
            </div>
          </Card>
        )}

        {/* 2. Browse all carriers (search + grouped list) */}
        <CarrierBrowser />

        {/* 3. Universal navigator pages */}
        <Card>
          <SectionHeading level="h2">Cross-carrier basics</SectionHeading>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            These pages apply across every carrier and are useful even before
            you save a plan.
          </p>
          <div style={{ marginTop: 'var(--v2-space-3)' }}>
            <Link
              href="/v2/insurance/pcp-explainer"
              style={{
                display: 'block',
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-accent-primary)',
                textDecoration: 'none',
                padding: 'var(--v2-space-2) 0',
              }}
            >
              What a PCP actually does
            </Link>
            <Link
              href="/v2/insurance/strategies"
              style={{
                display: 'block',
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-accent-primary)',
                textDecoration: 'none',
                padding: 'var(--v2-space-2) 0',
              }}
            >
              How to make your visit count
            </Link>
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
              Test navigator (test-by-test playbook)
            </Link>
          </div>
        </Card>
      </div>
    </MobileShell>
  )
}
