/*
 * /v2/insurance/tests/[slug] (server component)
 *
 * Catch-all test guide page. Renders the TestGuide for any slug
 * present in TEST_CATALOG (_data/tests.ts). One file gets us a
 * page per test in the playbook.
 *
 * If the slug does not exist in the catalog, we 404 via Next.js
 * `notFound()`. This protects against typos in deep-links from
 * the hub or from carrier pages.
 *
 * Voice: NC short, kind, explanatory. No em-dashes anywhere.
 */
import { notFound } from 'next/navigation'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import BackChevron from '../../_components/BackChevron'
import TestGuide from '../_components/TestGuide'
import { TEST_SLUGS, getTest } from '../_data/tests'

export const dynamic = 'force-static'

export function generateStaticParams() {
  return TEST_SLUGS.map((slug) => ({ slug }))
}

export default async function TestGuidePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const test = getTest(slug)
  if (!test) {
    notFound()
  }

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title={test.label}
          leading={<BackChevron href="/v2/insurance/tests" label="Back to test navigator" />}
        />
      }
    >
      <TestGuide test={test} />
    </MobileShell>
  )
}
