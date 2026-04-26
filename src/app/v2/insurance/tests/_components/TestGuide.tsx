/*
 * TestGuide
 *
 * Shared 9-section renderer for every test guide page under
 * /v2/insurance/tests/<slug>. Drives off the typed TestGuideData
 * record in _data/tests.ts so adding a new test guide is a data
 * change rather than a new component.
 *
 * Section order matches the user direction in the navigator brief:
 *   1. What it is
 *   2. Why a patient might need it (NC voice, condition-specific)
 *   3. How to ask your PCP for it (script)
 *   4. What to expect during the test
 *   5. Common results interpretation
 *   6. Common denial reasons + counter-arguments
 *   7. Specialist referral path if PCP cannot order
 *   8. Cost expectations
 *   9. Sources + related condition deep-dives
 *
 * Voice: NC short, kind, explanatory. Renderer never adds copy of its
 * own beyond labels; all narrative comes from the data.
 *
 * No em-dashes anywhere in this file.
 *
 * Server component, no client JS.
 */
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { Card } from '@/v2/components/primitives'
import SectionHeading from '../../_components/SectionHeading'
import type { TestGuideData, TestSource } from '../_data/tests'

// ── tiny visual helpers ─────────────────────────────────────────

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

function Paragraph({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: 'var(--v2-text-sm)',
        color: 'var(--v2-text-secondary)',
        lineHeight: 'var(--v2-leading-relaxed)',
      }}
    >
      {children}
    </p>
  )
}

function ScriptBlock({ children }: { children: React.ReactNode }) {
  return (
    <Card variant="explanatory" padding="md" style={{ marginTop: 'var(--v2-space-2)' }}>
      <p
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-sm)',
          color: 'var(--v2-surface-explanatory-text)',
          lineHeight: 'var(--v2-leading-relaxed)',
          fontStyle: 'italic',
        }}
      >
        {children}
      </p>
    </Card>
  )
}

function SourcesBlock({ sources }: { sources: TestSource[] }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-2)',
      }}
    >
      {sources.map((s, idx) => (
        <ExternalAnchor key={idx} href={s.href}>
          {s.label}
        </ExternalAnchor>
      ))}
      <p
        style={{
          margin: 'var(--v2-space-2) 0 0',
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-text-muted)',
          lineHeight: 'var(--v2-leading-relaxed)',
        }}
      >
        Sources captured April 2026. Clinical guidelines and coding rules change. Verify against
        the current peer-reviewed literature before acting on anything load-bearing.
      </p>
    </div>
  )
}

// ── main renderer ───────────────────────────────────────────────

export interface TestGuideProps {
  test: TestGuideData
}

export default function TestGuide({ test }: TestGuideProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-4)',
        padding: 'var(--v2-space-4)',
        paddingBottom: 'var(--v2-space-8)',
      }}
    >
      {/* Subtitle banner */}
      <Card>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-secondary)',
            lineHeight: 'var(--v2-leading-relaxed)',
            fontStyle: 'italic',
          }}
        >
          {test.subtitle}
        </p>
      </Card>

      {/* 1. What it is */}
      <Card>
        <SectionHeading level="h2">What it is</SectionHeading>
        <Paragraph>{test.whatItIs}</Paragraph>
      </Card>

      {/* 2. Why a patient might need it */}
      <Card>
        <SectionHeading level="h2">Why you might need it</SectionHeading>
        <Paragraph>{test.whyOrdered}</Paragraph>
      </Card>

      {/* 3. How to ask your PCP for it */}
      <Card>
        <SectionHeading level="h2">How to ask your PCP for it</SectionHeading>
        <Paragraph>
          A specific request is harder to deflect than a vague concern. A script you can adapt:
        </Paragraph>
        <ScriptBlock>{test.pcpScript}</ScriptBlock>
      </Card>

      {/* 4. What to expect during the test */}
      <Card>
        <SectionHeading level="h2">What to expect</SectionHeading>
        <Paragraph>{test.whatToExpect}</Paragraph>
      </Card>

      {/* 5. Common results interpretation */}
      <Card>
        <SectionHeading level="h2">Reading the results</SectionHeading>
        <Paragraph>{test.resultsInterpretation}</Paragraph>
      </Card>

      {/* 6. Common denial reasons + counter-arguments */}
      <Card>
        <SectionHeading level="h2">If insurance denies it</SectionHeading>
        <Paragraph>
          The denials below are common patterns. Each comes with a documented counter-argument; use
          the script in your appeal letter alongside the cited guideline.
        </Paragraph>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-3)',
            marginTop: 'var(--v2-space-3)',
          }}
        >
          {test.denialPushback.map((d, idx) => (
            <div
              key={idx}
              style={{
                paddingTop: 'var(--v2-space-3)',
                borderTop: idx === 0 ? 'none' : '1px solid var(--v2-border-subtle)',
              }}
            >
              <SectionHeading level="h3">Denial: {d.denialReason}</SectionHeading>
              <Paragraph>{d.counterArgument}</Paragraph>
              {d.citationLabel && (
                <p
                  style={{
                    margin: 'var(--v2-space-2) 0 0',
                    fontSize: 'var(--v2-text-xs)',
                    color: 'var(--v2-text-muted)',
                  }}
                >
                  Cite: {d.citationLabel}
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* 7. Specialist referral path */}
      <Card>
        <SectionHeading level="h2">If your PCP cannot order it</SectionHeading>
        <Paragraph>{test.specialistReferralPath}</Paragraph>
        <p
          style={{
            margin: 'var(--v2-space-3) 0 0',
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-muted)',
          }}
        >
          See{' '}
          <Link
            href="/v2/insurance/pcp-explainer"
            style={{ color: 'var(--v2-accent-primary)', textDecoration: 'none' }}
          >
            what a PCP actually does
          </Link>{' '}
          for the full explanation of when a referral is required.
        </p>
      </Card>

      {/* 8. Cost expectations */}
      <Card>
        <SectionHeading level="h2">Cost expectations</SectionHeading>
        <Paragraph>{test.costExpectations}</Paragraph>
        <p
          style={{
            margin: 'var(--v2-space-3) 0 0',
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-muted)',
            lineHeight: 'var(--v2-leading-relaxed)',
          }}
        >
          Numbers above are typical billed prices in the United States. Your actual cost depends on
          your plan, deductible status, in-network vs. out-of-network billing, and whether prior
          authorization was obtained. Always call the carrier with the CPT code before scheduling
          for a true cost estimate.
        </p>
      </Card>

      {/* 9a. Related topic links */}
      {test.relatedTopicHrefs && test.relatedTopicHrefs.length > 0 && (
        <Card>
          <SectionHeading level="h2">Related</SectionHeading>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--v2-space-2)',
            }}
          >
            {test.relatedTopicHrefs.map((r, idx) => (
              <Link
                key={idx}
                href={r.href}
                style={{
                  fontSize: 'var(--v2-text-sm)',
                  color: 'var(--v2-accent-primary)',
                  textDecoration: 'none',
                }}
              >
                {r.label}
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* 9b. Sources */}
      <Card>
        <SectionHeading level="h2">Sources</SectionHeading>
        <SourcesBlock sources={test.sources} />
      </Card>
    </div>
  )
}
