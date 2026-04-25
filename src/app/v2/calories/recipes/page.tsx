/**
 * /v2/calories/recipes
 *
 * The user's saved recipe library: Edamam, URL imports, and hand-built.
 */

import Link from 'next/link'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { EmptyState, Card } from '@/v2/components/primitives'
import { listSavedRecipes } from '@/lib/api/recipes'
import { loadRecipes } from '@/lib/calories/recipes'

export const metadata = { title: 'Recipes - LanaeHealth' }
export const dynamic = 'force-dynamic'

const ctaBase: React.CSSProperties = {
  flex: '1 1 160px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 'var(--v2-touch-target-min)',
  padding: 'var(--v2-space-3) var(--v2-space-4)',
  borderRadius: 999,
  fontSize: 'var(--v2-text-sm)',
  fontWeight: 'var(--v2-weight-semibold)',
  textDecoration: 'none',
  textAlign: 'center',
}
const ctaPrimary: React.CSSProperties = {
  ...ctaBase,
  background: 'var(--v2-accent-primary)',
  color: 'var(--v2-on-accent)',
  border: '1px solid var(--v2-accent-primary)',
}
const ctaSecondary: React.CSSProperties = {
  ...ctaBase,
  background: 'transparent',
  color: 'var(--v2-text-primary)',
  border: '1px solid var(--v2-border-strong)',
}
const ctaGhost: React.CSSProperties = {
  ...ctaBase,
  background: 'transparent',
  color: 'var(--v2-accent-primary)',
  border: '1px solid transparent',
}

export default async function RecipesIndexPage() {
  const [savedRecipes, customRecipes] = await Promise.all([
    listSavedRecipes(),
    loadRecipes(),
  ])

  const items = [
    ...savedRecipes.map((r) => ({
      id: r.id,
      name: r.name,
      source: r.source,
      caloriesPerServing: r.caloriesPerServing,
      ingredientCount: r.ingredients.length,
      detailHref: `/v2/calories/recipes/${encodeURIComponent(r.id)}`,
    })),
    ...customRecipes.entries.map((r) => ({
      id: r.id,
      name: r.name,
      source: 'user_custom' as const,
      caloriesPerServing: Math.round(r.perServing.calories),
      ingredientCount: r.ingredients.length,
      detailHref: `/v2/calories/recipes/${encodeURIComponent(r.id)}`,
    })),
  ]

  return (
    <MobileShell
      top={
        <TopAppBar
          title="Recipes"
          leading={
            <Link
              href="/v2/calories"
              aria-label="Back to calories"
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
        <Card padding="md">
          <div
            style={{
              display: 'flex',
              gap: 'var(--v2-space-2)',
              flexWrap: 'wrap',
            }}
          >
            <Link
              href="/v2/calories/recipes/search"
              data-testid="recipe-search-cta"
              style={ctaPrimary}
            >
              Search recipes
            </Link>
            <Link href="/v2/calories/recipes/import" style={ctaSecondary}>
              Paste a URL
            </Link>
            <Link href="/v2/calories/recipes/new" style={ctaGhost}>
              Build your own
            </Link>
          </div>
        </Card>

        {items.length === 0 ? (
          <EmptyState
            headline="No recipes yet"
            subtext="Search a database of millions of recipes, paste a URL from any blog, or build your own."
          />
        ) : (
          <div
            data-testid="recipes-list"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--v2-space-2)',
            }}
          >
            {items.map((item) => (
              <Link
                key={`${item.source}_${item.id}`}
                href={item.detailHref}
                style={{ textDecoration: 'none', color: 'inherit' }}
                data-testid="recipe-list-row"
              >
                <Card padding="md">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 'var(--v2-space-3)',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontWeight: 'var(--v2-weight-semibold)',
                          color: 'var(--v2-text-primary)',
                          marginBottom: 4,
                        }}
                      >
                        {item.name}
                      </div>
                      <div
                        style={{
                          fontSize: 'var(--v2-text-xs)',
                          color: 'var(--v2-text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: 'var(--v2-tracking-wide)',
                        }}
                      >
                        {sourceLabel(item.source)} {' '}
                        {item.ingredientCount} ingredient
                        {item.ingredientCount === 1 ? '' : 's'}
                      </div>
                    </div>
                    <div
                      style={{
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 'var(--v2-weight-semibold)',
                        color: 'var(--v2-text-secondary)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.caloriesPerServing}
                      <span
                        style={{
                          fontSize: 'var(--v2-text-xs)',
                          color: 'var(--v2-text-muted)',
                          marginLeft: 4,
                          fontWeight: 'var(--v2-weight-medium)',
                        }}
                      >
                        cal/srv
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </MobileShell>
  )
}

function sourceLabel(source: string): string {
  if (source === 'edamam') return 'From Edamam'
  if (source === 'user_url') return 'From URL'
  return 'Built by you'
}
