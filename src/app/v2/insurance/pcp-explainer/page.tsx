/*
 * /v2/insurance/pcp-explainer (server component)
 *
 * Universal explainer (not plan-specific) on what a PCP actually does.
 * Goal: dispel the assumption that the PCP is a chronic illness expert.
 *
 * The "PCP is a gatekeeper, not a specialist" framing is grounded in
 * standard HMO plan structure (S1, S2 in the research doc). The
 * specialist-referral script is paraphrased from chronic-illness
 * advocacy guidance (S8, S9) and rendered in NC voice.
 *
 * Voice rules:
 *   - Gentle, never aggressive
 *   - No em-dashes
 *   - Reads as "here is how the system works", not "you should fight"
 */
import Link from 'next/link'
import { Card } from '@/v2/components/primitives'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import BackChevron from '../_components/BackChevron'
import SectionHeading from '../_components/SectionHeading'

export const dynamic = 'force-dynamic'

export default function PcpExplainerPage() {
  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="What a PCP actually does"
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
        <Card>
          <SectionHeading level="h2">The short version</SectionHeading>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            A PCP (primary care physician) is your care coordinator. They
            handle annual checkups, routine illnesses, screening labs, and
            most prescription refills. On HMO plans like HMSA QUEST, they
            also act as the gatekeeper for specialist referrals.
          </p>
          <p
            style={{
              margin: 'var(--v2-space-3) 0 0',
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            They are not a chronic illness specialist. A PCP will not
            diagnose POTS, manage migraine prevention long-term, work up
            suspected endometriosis, or interpret advanced labs the way a
            cardiologist, neurologist, or gynecologist would. Their job is
            to recognize the pattern and send you to the right specialist.
          </p>
        </Card>

        <Card>
          <SectionHeading level="h2">What a PCP does well</SectionHeading>
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
            <li>Annual physicals and preventive screening</li>
            <li>Routine illness (colds, infections, sprains)</li>
            <li>Most prescription refills</li>
            <li>Standard labs (CBC, metabolic panel, lipid panel)</li>
            <li>Coordinating between your specialists</li>
            <li>Writing referrals when something needs deeper expertise</li>
          </ul>
        </Card>

        <Card>
          <SectionHeading level="h2">What a PCP is not built for</SectionHeading>
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
            <li>Diagnosing autonomic disorders like POTS</li>
            <li>Working up complex headache or migraine syndromes</li>
            <li>Managing suspected endometriosis or pelvic pain</li>
            <li>Interpreting nuanced cardiology, hematology, or endocrine labs</li>
            <li>Long-term management of rheumatologic conditions</li>
            <li>Genetic counseling or workup for connective tissue disorders</li>
          </ul>
          <p
            style={{
              margin: 'var(--v2-space-3) 0 0',
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            For any of these, the right move is a referral to the
            corresponding specialist. The PCP&apos;s job is to make that happen,
            not to handle it themselves.
          </p>
        </Card>

        <Card>
          <SectionHeading level="h2">Asking for a specialist referral</SectionHeading>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            A clear, prepared ask works better than a vague concern. The
            structure that lands well:
          </p>
          <ol
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
            <li>Name the specialty you want to see</li>
            <li>Name the specific concern (one or two sentences)</li>
            <li>Name the symptoms with function impact, not just severity</li>
            <li>Name what you have already tried</li>
            <li>Ask for the referral by name</li>
          </ol>
          <Card
            variant="explanatory"
            padding="md"
            style={{ marginTop: 'var(--v2-space-3)' }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-surface-explanatory-text)',
                lineHeight: 'var(--v2-leading-relaxed)',
                fontStyle: 'italic',
              }}
            >
              &quot;I would like a referral to a cardiologist or autonomic
              specialist. I have been having near-fainting episodes when I
              stand, my heart races on stairs, and one true blackout in
              January. I have already tried more salt and electrolytes
              and that has not resolved it. Can you put in the referral?&quot;
            </p>
          </Card>
          <p
            style={{
              margin: 'var(--v2-space-3) 0 0',
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
              lineHeight: 'var(--v2-leading-normal)',
            }}
          >
            Script structure adapted from POTS Patient Support and NormaLyte
            chronic-illness advocacy resources (sources S8, S9 in the
            research doc).
          </p>
        </Card>

        <Card>
          <SectionHeading level="h2">When to switch PCPs</SectionHeading>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            A PCP relationship can be hard to leave once you have records
            with them, but the relationship is supposed to serve you. A few
            patterns are worth taking seriously:
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
            <li>They refuse all specialist referrals you ask for</li>
            <li>They consistently attribute physical symptoms to anxiety with no workup</li>
            <li>They will not document your concerns or test refusals in your chart</li>
            <li>They make you feel worse than when you walked in</li>
          </ul>
          <p
            style={{
              margin: 'var(--v2-space-3) 0 0',
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            Most insurance plans, including HMSA QUEST, let you change PCPs
            by calling member services. The{' '}
            <Link
              href="/v2/insurance/strategies"
              style={{ color: 'var(--v2-accent-primary)', textDecoration: 'none' }}
            >
              strategies page
            </Link>{' '}
            covers what to do when a visit goes sideways.
          </p>
        </Card>
      </div>
    </MobileShell>
  )
}
