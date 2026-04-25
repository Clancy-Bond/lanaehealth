/**
 * /v2/calories/recipes/search
 *
 * Search Edamam (2.3M recipes). Saving a result persists into
 * user_recipes via /api/calories/recipes/save-external.
 */

import Link from 'next/link'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { Banner, EmptyState, Card } from '@/v2/components/primitives'
import { isEdamamConfigured, searchRecipes } from '@/lib/api/recipes'
import RecipeSearchForm from './_components/RecipeSearchForm'
import RecipeSearchResultRow from './_components/RecipeSearchResultRow'

export const metadata = { title: 'Search recipes - LanaeHealth' }
export const dynamic = 'force-dynamic'

export default async function RecipeSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const params = await searchParams
  const q = (params.q ?? '').trim()
  const configured = isEdamamConfigured()
  const results = q && configured ? await searchRecipes(q) : []

  return (
    <MobileShell
      top={
        <TopAppBar
          title="Search recipes"
          leading={
            <Link
              href="/v2/calories/recipes"
              aria-label="Back to recipes"
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
              Back
            </Link>
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
          paddingBottom: 'var(--v2-space-12)',
          maxWidth: 640,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {!configured && (
          <Banner
            intent="warning"
            title="Recipe search needs an API key"
            body="Add EDAMAM_APP_ID and EDAMAM_APP_KEY to Vercel env (Preview + Production). Get a free key at developer.edamam.com (5 req/min, 10K/month)."
          />
        )}

        <RecipeSearchForm initialQuery={q} disabled={!configured} />

        {configured && q && results.length === 0 && (
          <EmptyState
            headline="No matches"
            subtext="Try a simpler term, or paste a recipe URL from your favorite blog."
          />
        )}

        {!q && configured && (
          <Card padding="md">
            <div
              style={{
                color: 'var(--v2-text-secondary)',
                fontSize: 'var(--v2-text-sm)',
                lineHeight: 1.5,
              }}
            >
              Search 2.3 million recipes from across the web. Pick one to
              see ingredients and per-serving nutrition before saving.
            </div>
          </Card>
        )}

        {results.length > 0 && (
          <div
            data-testid="recipe-search-results"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--v2-space-2)',
            }}
          >
            {results.map((r) => (
              <RecipeSearchResultRow key={r.sourceId ?? r.id} recipe={r} />
            ))}
          </div>
        )}
      </div>
    </MobileShell>
  )
}
