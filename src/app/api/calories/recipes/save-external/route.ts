/**
 * POST /api/calories/recipes/save-external
 *
 * Persist an Edamam-search-result or URL-imported recipe into
 * user_recipes. Body accepts JSON with the full Recipe shape (minus
 * id) OR { source: 'edamam', uri } / { source: 'user_url', url } so
 * the client can pass a thin reference and we re-fetch.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  type Recipe,
  fetchEdamamRecipe,
  importRecipeFromUrl,
  saveRecipe,
} from '@/lib/api/recipes'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Bad JSON.' }, { status: 400 })
  }

  let recipe: Recipe | null = null
  const source = String(body.source ?? '')

  if (source === 'edamam') {
    if (body.recipe && typeof body.recipe === 'object') {
      recipe = body.recipe as Recipe
    } else if (typeof body.uri === 'string') {
      recipe = await fetchEdamamRecipe(body.uri)
    }
  } else if (source === 'user_url') {
    if (body.recipe && typeof body.recipe === 'object') {
      recipe = body.recipe as Recipe
    } else if (typeof body.url === 'string') {
      recipe = await importRecipeFromUrl(body.url)
    }
  } else if (source === 'user_custom') {
    if (body.recipe && typeof body.recipe === 'object') {
      recipe = body.recipe as Recipe
    }
  }

  if (!recipe) {
    return NextResponse.json(
      { error: 'Could not resolve recipe.' },
      { status: 400 },
    )
  }

  const result = await saveRecipe(recipe)
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? 'save failed' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, recipe: result.recipe }, { status: 200 })
}
