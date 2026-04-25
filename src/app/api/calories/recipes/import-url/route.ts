/**
 * POST /api/calories/recipes/import-url
 *
 * Parse a recipe from a user-pasted URL (schema.org/Recipe JSON-LD).
 * Returns the parsed Recipe (without saving) so the user can review
 * before persisting via /save-external.
 *
 * Body: { url: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { importRecipeFromUrl } from '@/lib/api/recipes'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const URL_RE = /^https?:\/\//i

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Bad JSON.' }, { status: 400 })
  }

  const raw = String(body.url ?? '').trim()
  if (!raw || !URL_RE.test(raw)) {
    return NextResponse.json({ error: 'Need an http(s) URL.' }, { status: 400 })
  }

  const recipe = await importRecipeFromUrl(raw)
  if (!recipe) {
    return NextResponse.json(
      {
        error:
          'Could not parse a recipe from that page. Try a site that uses schema.org/Recipe markup, or build the recipe by hand.',
      },
      { status: 422 },
    )
  }

  return NextResponse.json({ ok: true, recipe }, { status: 200 })
}
