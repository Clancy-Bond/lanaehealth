/**
 * /v2/calories/recipes/[id]
 *
 * Recipe detail with ingredients, nutrition, and "Log a serving".
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { Card } from '@/v2/components/primitives'
import { findSavedRecipe, type Recipe } from '@/lib/api/recipes'
import { findRecipe as findCustomRecipe } from '@/lib/calories/recipes'
import RecipeLogServingForm from './_components/RecipeLogServingForm'

export const metadata = { title: 'Recipe - LanaeHealth' }
export const dynamic = 'force-dynamic'

export default async function RecipeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ date?: string; meal?: string }>
}) {
  const { id: rawId } = await params
  const id = decodeURIComponent(rawId)
  const sp = await searchParams

  const saved = await findSavedRecipe(id)
  let recipe: Recipe | null = saved
  if (!recipe) {
    const legacy = await findCustomRecipe(id)
    if (legacy) {
      recipe = {
        id: legacy.id,
        source: 'user_custom',
        name: legacy.name,
        servings: legacy.servings,
        caloriesPerServing: Math.round(legacy.perServing.calories),
        ingredients: legacy.ingredients.map((i) => ({ raw: i.name })),
        nutritionPerServing: {
          calories: Math.round(legacy.perServing.calories),
          protein: legacy.perServing.macros.protein ?? 0,
          carbs: legacy.perServing.macros.carbs ?? 0,
          fat: legacy.perServing.macros.fat ?? 0,
          fiber: legacy.perServing.macros.fiber,
          sugar: legacy.perServing.macros.sugar,
          sodium: legacy.perServing.macros.sodium,
        },
      }
    }
  }

  if (!recipe) notFound()

  return (
    <MobileShell
      top={
        <TopAppBar
          title={recipe.name}
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
        {recipe.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recipe.imageUrl}
            alt=""
            style={{
              width: '100%',
              maxHeight: 240,
              objectFit: 'cover',
              borderRadius: 'var(--v2-radius-lg)',
            }}
          />
        )}

        <Card padding="md">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 'var(--v2-space-3)',
            }}
          >
            <Stat label="Calories / serving" value={`${recipe.caloriesPerServing}`} />
            <Stat label="Servings" value={`${recipe.servings}`} />
            <Stat label="Protein" value={`${recipe.nutritionPerServing.protein.toFixed(1)} g`} />
            <Stat label="Carbs" value={`${recipe.nutritionPerServing.carbs.toFixed(1)} g`} />
            <Stat label="Fat" value={`${recipe.nutritionPerServing.fat.toFixed(1)} g`} />
            {recipe.totalTimeMinutes ? (
              <Stat label="Total time" value={`${recipe.totalTimeMinutes} min`} />
            ) : (
              <Stat label="Source" value={sourceLabel(recipe.source)} />
            )}
          </div>
        </Card>

        <Card padding="md">
          <SectionHeader>Ingredients</SectionHeader>
          {recipe.ingredients.length === 0 ? (
            <div style={{ color: 'var(--v2-text-muted)', fontSize: 'var(--v2-text-sm)' }}>
              No ingredients listed.
            </div>
          ) : (
            <ul
              data-testid="recipe-ingredients"
              style={{
                listStyle: 'disc',
                paddingLeft: 20,
                margin: 0,
                color: 'var(--v2-text-primary)',
                fontSize: 'var(--v2-text-sm)',
                lineHeight: 1.6,
              }}
            >
              {recipe.ingredients.map((ing, i) => (
                <li key={i}>{ing.raw || `${ing.amount ?? ''} ${ing.unit ?? ''} ${ing.name ?? ''}`.trim()}</li>
              ))}
            </ul>
          )}
        </Card>

        {recipe.url && (
          <a
            href={recipe.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-accent-primary)',
              textAlign: 'center',
            }}
          >
            View original recipe
          </a>
        )}

        <RecipeLogServingForm
          recipeId={recipe.id}
          defaultDate={typeof sp.date === 'string' ? sp.date : undefined}
          defaultMeal={typeof sp.meal === 'string' ? sp.meal : undefined}
        />
      </div>
    </MobileShell>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--v2-tracking-wide)',
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 'var(--v2-weight-semibold)',
          color: 'var(--v2-text-primary)',
        }}
      >
        {value}
      </div>
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 'var(--v2-text-xs)',
        color: 'var(--v2-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: 'var(--v2-tracking-wide)',
        marginBottom: 'var(--v2-space-2)',
      }}
    >
      {children}
    </div>
  )
}

function sourceLabel(source: string): string {
  if (source === 'edamam') return 'Edamam'
  if (source === 'user_url') return 'Imported URL'
  return 'Hand-built'
}
