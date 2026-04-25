/*
 * /v2/insurance/hmsa-quest (server component)
 *
 * The HMSA QUEST Integration plan guide. This is the v0 baseline
 * for the navigator and the template every other plan page should
 * follow. Eight sections:
 *
 *   1. Quick reference (member id, who to call)
 *   2. Coverage overview for chronic illness
 *   3. Your network in Honolulu
 *   4. Referral playbook (when you do / do not need one)
 *   5. Appeals process
 *   6. Prior auth tips
 *   7. Telehealth coverage
 *   8. Resources (HMSA + condition-specific advocacy)
 *
 * Every factual claim about HMSA policy cites a source from
 * docs/research/insurance-navigator-research.md by number (S1..S11).
 *
 * NC voice throughout: gentle, never aggressive. Reads as "here is
 * how the system works" rather than "do these steps". Voice rule:
 * no em-dashes anywhere in this file.
 */
import Link from 'next/link'
import { ExternalLink, Phone } from 'lucide-react'
import { getInsuranceProfile } from '@/lib/api/insurance'
import { Card } from '@/v2/components/primitives'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import BackChevron from '../_components/BackChevron'
import SectionHeading from '../_components/SectionHeading'

export const dynamic = 'force-dynamic'

// Wrapper for "value rows" inside the quick reference card. Keeps the
// label/value layout consistent without dragging in another primitive.
function ValueRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 'var(--v2-space-3)',
        padding: 'var(--v2-space-2) 0',
        borderBottom: '1px solid var(--v2-border-subtle)',
      }}
    >
      <span
        style={{
          fontSize: 'var(--v2-text-sm)',
          color: 'var(--v2-text-secondary)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 'var(--v2-text-sm)',
          color: 'var(--v2-text-primary)',
          fontWeight: 'var(--v2-weight-medium)',
          textAlign: 'right',
        }}
      >
        {value}
      </span>
    </div>
  )
}

function ExternalAnchor({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: 'var(--v2-accent-primary)',
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {children}
      <ExternalLink size={12} aria-hidden="true" />
    </a>
  )
}

function PhoneAnchor({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      style={{
        color: 'var(--v2-accent-primary)',
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <Phone size={12} aria-hidden="true" />
      {label}
    </a>
  )
}

export default async function HmsaQuestPage() {
  const profile = await getInsuranceProfile()
  const memberId = profile?.planSlug === 'hmsa-quest' ? profile.memberId : undefined

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="HMSA QUEST Integration"
          leading={<BackChevron href="/v2/insurance" label="Back to insurance hub" />}
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
        {/* 1. Quick reference */}
        {/* Source S1: HMSA QUEST is HMSA's Medicaid managed care plan. */}
        {/* Source S2: phone numbers for Provider Service. */}
        <Card>
          <SectionHeading level="h2">Quick reference</SectionHeading>
          <ValueRow label="Plan" value="HMSA QUEST Integration" />
          <ValueRow label="Plan type" value="Medicaid managed care (HMO)" />
          <ValueRow label="State" value="Hawaii" />
          <ValueRow
            label="Member ID"
            value={memberId ?? 'Add it on the setup page.'}
          />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--v2-space-2)',
              marginTop: 'var(--v2-space-3)',
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-secondary)',
              }}
            >
              Member services on Oahu: <PhoneAnchor href="tel:8089486486" label="(808) 948-6486" />
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-secondary)',
              }}
            >
              Toll-free from neighbor islands: <PhoneAnchor href="tel:18004400640" label="(800) 440-0640" />
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-text-muted)',
                marginTop: 'var(--v2-space-2)',
              }}
            >
              Numbers from HMSA QUEST Integration Provider Service listing
              (hmsa.com).
            </p>
          </div>
        </Card>

        {/* 2. Coverage overview */}
        {/* Source S4: covered services list from medquest.hawaii.gov. */}
        <Card>
          <SectionHeading level="h2">What is covered for chronic illness</SectionHeading>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            QUEST Integration covers a broad set of services that map well to
            a complex chronic illness workup. The covered list includes:
          </p>
          <ul
            style={{
              margin: 'var(--v2-space-3) 0 0',
              padding: '0 0 0 var(--v2-space-4)',
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-primary)',
              lineHeight: 'var(--v2-leading-relaxed)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--v2-space-1)',
            }}
          >
            <li>
              Diagnostic tests, including labs, imaging, and &quot;other diagnostic
              tests&quot; (this language covers tilt-table testing and autonomic
              workup when medically necessary)
            </li>
            <li>Outpatient hospital procedures, including sleep laboratory studies</li>
            <li>Specialist visits with a PCP referral</li>
            <li>Prescription drugs (formulary applies, see prior auth below)</li>
            <li>Outpatient mental health and medication management</li>
            <li>Rehabilitation services, including cognitive rehab</li>
            <li>Pregnancy-related services and family planning</li>
            <li>Nutrition counseling</li>
          </ul>
          <p
            style={{
              margin: 'var(--v2-space-3) 0 0',
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
            }}
          >
            Source: QUEST Integration Benefits, Hawaii Med-QUEST
            (medquest.hawaii.gov, captured April 2026).
          </p>
        </Card>

        {/* 3. Your network */}
        {/* Source S1: network is Hawaii physicians, directory at hmsa.com/search/providers/. */}
        <Card>
          <SectionHeading level="h2">Your network in Honolulu</SectionHeading>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            HMSA QUEST has a large in-state provider network. The directory
            lets you filter by specialty, language, gender, and location, so
            you can find a Honolulu specialist your plan covers.
          </p>
          <div
            style={{
              marginTop: 'var(--v2-space-3)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--v2-space-2)',
            }}
          >
            <ExternalAnchor href="https://hmsa.com/search/providers/">
              HMSA provider directory
            </ExternalAnchor>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-text-muted)',
              }}
            >
              Filter by &quot;Specialist&quot; and your specialty (cardiology,
              gynecology, neurology) and set location to Honolulu or your
              area.
            </p>
          </div>
        </Card>

        {/* 4. Referral playbook */}
        {/* Source S2: PCP referral required for most specialty care; emergency exempt. */}
        <Card>
          <SectionHeading level="h2">Referrals: when you need one</SectionHeading>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            HMSA QUEST is an HMO. Your PCP coordinates referrals to
            specialists. The plan policy reads: &quot;A PCP referral is required
            for most services provided by specialists.&quot;
          </p>

          <SectionHeading level="h3">You need a referral for</SectionHeading>
          <ul
            style={{
              margin: 0,
              padding: '0 0 0 var(--v2-space-4)',
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-primary)',
              lineHeight: 'var(--v2-leading-relaxed)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--v2-space-1)',
            }}
          >
            <li>Cardiology, neurology, rheumatology, gastroenterology, dermatology</li>
            <li>Endocrinology, hematology, allergy and immunology</li>
            <li>Most other specialty visits</li>
          </ul>

          <SectionHeading level="h3">You do not need a referral for</SectionHeading>
          <ul
            style={{
              margin: 0,
              padding: '0 0 0 var(--v2-space-4)',
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-primary)',
              lineHeight: 'var(--v2-leading-relaxed)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--v2-space-1)',
            }}
          >
            <li>Emergency care (any provider, in or out of network)</li>
            <li>Urgent care</li>
            <li>Your PCP and primary care visits</li>
            <li>OB-GYN visits typically allow direct access; confirm with HMSA when scheduling</li>
          </ul>

          <SectionHeading level="h3">How to ask your PCP for a referral</SectionHeading>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            See the{' '}
            <Link
              href="/v2/insurance/pcp-explainer"
              style={{ color: 'var(--v2-accent-primary)', textDecoration: 'none' }}
            >
              PCP explainer
            </Link>{' '}
            for the full script. Short version: name the specialty, name the
            symptoms, name what you have already tried, and ask for the
            referral by name.
          </p>

          <p
            style={{
              margin: 'var(--v2-space-3) 0 0',
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
            }}
          >
            Source: QUEST Integration Referrals policy on prc.hmsa.com,
            captured April 2026. Always confirm OB-GYN direct access against
            your current member handbook.
          </p>
        </Card>

        {/* 5. Appeals process */}
        {/* Source S3: timeframes and steps. Source S7: external review. */}
        <Card id="appeals">
          <SectionHeading level="h2">If a claim or service is denied</SectionHeading>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            HMSA QUEST has two paths: a grievance (when something feels
            wrong about how you were treated) and an appeal (when a claim
            or service is denied). Both can be filed by you or someone you
            authorize.
          </p>

          <SectionHeading level="h3">Standard appeal</SectionHeading>
          <ul
            style={{
              margin: 0,
              padding: '0 0 0 var(--v2-space-4)',
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-primary)',
              lineHeight: 'var(--v2-leading-relaxed)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--v2-space-1)',
            }}
          >
            <li>File within 60 days of the denial</li>
            <li>Phone appeals must be followed by a signed written request</li>
            <li>A medical director (not the original reviewer) reviews clinical denials</li>
          </ul>

          <SectionHeading level="h3">Expedited appeal</SectionHeading>
          <ul
            style={{
              margin: 0,
              padding: '0 0 0 var(--v2-space-4)',
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-primary)',
              lineHeight: 'var(--v2-leading-relaxed)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--v2-space-1)',
            }}
          >
            <li>Use this when waiting could seriously harm your health</li>
            <li>File within 60 calendar days of the denial letter</li>
            <li>An oral request is enough; no written request required</li>
          </ul>

          <SectionHeading level="h3">If you are still unhappy</SectionHeading>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            Ask DHS Med-QUEST for a state-level review. Oahu line:{' '}
            <PhoneAnchor href="tel:8086928094" label="(808) 692-8094" />. You
            can also request an external review from the Hawaii Insurance
            Commissioner so an independent organization looks at your case.
          </p>

          <p
            style={{
              margin: 'var(--v2-space-3) 0 0',
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
            }}
          >
            Sources: QUEST Integration Member Grievances and Appeals
            (hmsa.com); HMSA Appeals & Grievances landing page; both
            captured April 2026.
          </p>

          <div
            style={{
              marginTop: 'var(--v2-space-3)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--v2-space-2)',
            }}
          >
            <ExternalAnchor href="https://hmsa.com/help-center/quest-integration-member-grievances-and-appeals/">
              HMSA QUEST grievances and appeals page
            </ExternalAnchor>
            <ExternalAnchor href="https://hmsa.com/help-center/request-for-ic-external-review/">
              Request external review (Insurance Commissioner)
            </ExternalAnchor>
          </div>
        </Card>

        {/* 6. Prior auth */}
        {/* Source S2: precertification required for out-of-network specialty. Source S4: drug formulary linked, not reproduced. */}
        <Card>
          <SectionHeading level="h2">Prior authorization tips</SectionHeading>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            HMSA calls prior authorization &quot;precertification&quot;. You will run
            into it when:
          </p>
          <ul
            style={{
              margin: 'var(--v2-space-2) 0 0',
              padding: '0 0 0 var(--v2-space-4)',
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-primary)',
              lineHeight: 'var(--v2-leading-relaxed)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--v2-space-1)',
            }}
          >
            <li>Your PCP refers you to an out-of-network specialist</li>
            <li>A specialty drug is on the formulary&apos;s tiered or restricted list</li>
            <li>An imaging study is high-cost (MRI, CT, PET)</li>
            <li>An outpatient surgery is scheduled</li>
          </ul>
          <p
            style={{
              margin: 'var(--v2-space-3) 0 0',
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            Your provider&apos;s office submits the precertification request. If
            it gets denied, that is when the appeals process above kicks in.
          </p>
          <div
            style={{
              marginTop: 'var(--v2-space-3)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--v2-space-2)',
            }}
          >
            <ExternalAnchor href="https://prc.hmsa.com/s/article/HMSA-s-QUEST-Drug-Formulary">
              HMSA QUEST drug formulary
            </ExternalAnchor>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-text-muted)',
              }}
            >
              We link to the live formulary instead of copying it because the
              list changes regularly.
            </p>
          </div>
        </Card>

        {/* 7. Telehealth */}
        {/* Source S5: telehealth is a benefit of most HMSA plans, copay may apply. */}
        <Card>
          <SectionHeading level="h2">Telehealth coverage</SectionHeading>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            HMSA covers telehealth visits with Hawaii-licensed providers.
            HMSA&apos;s own description: &quot;A telehealth visit costs about the same
            or less than a doctor&apos;s office visit.&quot; Telehealth is useful for
            general health concerns, behavioral health follow-ups,
            dermatology, and nutrition counseling.
          </p>
          <p
            style={{
              margin: 'var(--v2-space-3) 0 0',
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            HMSA&apos;s Online Care offers 24/7 video access to Hawaii-licensed
            providers if your usual clinic is closed or you do not have a
            primary care doctor yet.
          </p>
          <div
            style={{
              marginTop: 'var(--v2-space-3)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--v2-space-2)',
            }}
          >
            <ExternalAnchor href="https://hmsa.com/well-being/telehealth/">
              HMSA telehealth overview
            </ExternalAnchor>
            <ExternalAnchor href="https://hmsa.com/well-being/online-care/">
              HMSA&apos;s Online Care (24/7 video)
            </ExternalAnchor>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-text-muted)',
              }}
            >
              Source: HMSA Telehealth (hmsa.com), captured April 2026.
            </p>
          </div>
        </Card>

        {/* 8. Resources */}
        {/* Source S11: Dysautonomia International for POTS-relevant advocacy. */}
        <Card>
          <SectionHeading level="h2">Resources</SectionHeading>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--v2-space-2)',
            }}
          >
            <ExternalAnchor href="https://hmsa.com/help-center/member-handbook/">
              HMSA QUEST member handbook (full plan rules)
            </ExternalAnchor>
            <ExternalAnchor href="https://hmsa.com/contact/">
              HMSA member services and Neighborhood Centers
            </ExternalAnchor>
            <ExternalAnchor href="https://medquest.hawaii.gov/en/members-applicants.html">
              Hawaii Med-QUEST member portal
            </ExternalAnchor>
            <ExternalAnchor href="https://www.dysautonomiainternational.org/">
              Dysautonomia International (POTS advocacy)
            </ExternalAnchor>
            <ExternalAnchor href="https://migrainetrust.org/">
              The Migraine Trust (migraine advocacy and resources)
            </ExternalAnchor>
          </div>
        </Card>
      </div>
    </MobileShell>
  )
}
