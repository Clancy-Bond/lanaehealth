/*
 * /v2/insurance/tests (server component)
 *
 * The test navigator hub. Lists categories first, then the full
 * alphabetical test list inside each category. Tap a category to
 * jump to a category page; tap a test to land on its full guide.
 *
 * Structure:
 *   1. Banner explaining what the navigator is
 *   2. Per-category cards with test list
 *   3. Cross-link back to the insurance hub
 *
 * Voice: NC short, kind, explanatory. The whole hub reads as
 * "here is how to ask for the test", not "you should fight your
 * doctor".
 *
 * No em-dashes anywhere in this file (CLAUDE.md voice rule).
 */
import Link from 'next/link'
import { Card } from '@/v2/components/primitives'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import BackChevron from '../_components/BackChevron'
import SectionHeading from '../_components/SectionHeading'
import { TEST_CATEGORIES, getTestsByCategory } from './_data/tests'

export const dynamic = 'force-static'

export default function TestNavigatorHubPage() {
  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="Test navigator"
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
          <SectionHeading level="h2">What this is</SectionHeading>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            A test-by-test playbook for chronic illness patients. Each guide explains what the
            test measures, why a patient might want it, a script for asking your PCP, what to
            expect during the test, how to read the results, and what to do if insurance denies
            coverage. Coverage focus is POTS, migraine, and EDS-MCAS clusters.
          </p>
        </Card>

        {TEST_CATEGORIES.map((cat) => {
          const tests = getTestsByCategory(cat.slug)
          return (
            <Card key={cat.slug}>
              <SectionHeading level="h2">{cat.label}</SectionHeading>
              <p
                style={{
                  margin: 0,
                  fontSize: 'var(--v2-text-sm)',
                  color: 'var(--v2-text-secondary)',
                  lineHeight: 'var(--v2-leading-relaxed)',
                }}
              >
                {cat.shortDescription}
              </p>
              <div
                style={{
                  marginTop: 'var(--v2-space-3)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {tests.map((t) => (
                  <Link
                    key={t.slug}
                    href={`/v2/insurance/tests/${t.slug}`}
                    style={{
                      display: 'block',
                      padding: 'var(--v2-space-3) 0',
                      borderTop: '1px solid var(--v2-border-subtle)',
                      textDecoration: 'none',
                      color: 'var(--v2-text-primary)',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 'var(--v2-text-sm)',
                        fontWeight: 'var(--v2-weight-medium)',
                      }}
                    >
                      {t.label}
                    </span>
                    <p
                      style={{
                        margin: '2px 0 0',
                        fontSize: 'var(--v2-text-xs)',
                        color: 'var(--v2-text-muted)',
                        lineHeight: 'var(--v2-leading-relaxed)',
                      }}
                    >
                      {t.subtitle}
                    </p>
                  </Link>
                ))}
              </div>
            </Card>
          )
        })}

        <Card>
          <SectionHeading level="h2">Related</SectionHeading>
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
        </Card>
      </div>
    </MobileShell>
  )
}
