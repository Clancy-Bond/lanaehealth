/*
 * /v2/insurance/tests/category/[slug] (server component)
 *
 * Category landing page. Lists every test in a single category.
 * Useful when a deep-link from a condition deep-dive (e.g. orthostatic
 * topic page) wants to surface only the relevant subset.
 *
 * Voice: NC short, kind, explanatory. No em-dashes anywhere.
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card } from '@/v2/components/primitives'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import BackChevron from '../../../_components/BackChevron'
import SectionHeading from '../../../_components/SectionHeading'
import { TEST_CATEGORIES, getCategory, getTestsByCategory } from '../../_data/tests'
import type { TestCategorySlug } from '../../_data/tests'

export const dynamic = 'force-static'

export function generateStaticParams() {
  return TEST_CATEGORIES.map((c) => ({ slug: c.slug }))
}

export default async function TestCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const category = getCategory(slug as TestCategorySlug)
  if (!category) {
    notFound()
  }
  const tests = getTestsByCategory(category.slug)

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title={category.label}
          leading={
            <BackChevron href="/v2/insurance/tests" label="Back to test navigator" />
          }
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
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            {category.shortDescription}
          </p>
        </Card>

        {tests.map((t) => (
          <Card key={t.slug}>
            <Link
              href={`/v2/insurance/tests/${t.slug}`}
              style={{
                display: 'block',
                textDecoration: 'none',
                color: 'var(--v2-text-primary)',
              }}
            >
              <SectionHeading level="h2">{t.label}</SectionHeading>
              <p
                style={{
                  margin: 0,
                  fontSize: 'var(--v2-text-sm)',
                  color: 'var(--v2-text-secondary)',
                  lineHeight: 'var(--v2-leading-relaxed)',
                }}
              >
                {t.subtitle}
              </p>
            </Link>
          </Card>
        ))}
      </div>
    </MobileShell>
  )
}
