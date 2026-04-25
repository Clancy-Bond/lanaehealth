/**
 * GET /api/calories/recipes/search-external?q=<query>
 *
 * Search the Edamam Recipe Search API. Returns [] (with a friendly
 * status payload) if EDAMAM_APP_ID + EDAMAM_APP_KEY are not set.
 */

import { NextRequest, NextResponse } from 'next/server'
import { isEdamamConfigured, searchRecipes } from '@/lib/api/recipes'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const q = (url.searchParams.get('q') ?? '').trim()
  if (!q) {
    return NextResponse.json({ ok: true, results: [], configured: isEdamamConfigured() })
  }
  if (!isEdamamConfigured()) {
    return NextResponse.json({
      ok: true,
      results: [],
      configured: false,
      message:
        'Recipe search needs Edamam API key. Add EDAMAM_APP_ID + EDAMAM_APP_KEY to Vercel env.',
    })
  }
  const results = await searchRecipes(q)
  return NextResponse.json({ ok: true, results, configured: true })
}
