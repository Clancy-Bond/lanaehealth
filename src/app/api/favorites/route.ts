/**
 * Home Favorites API Route (Wave 2e F5).
 *
 *   GET  /api/favorites  -> { items: FavoriteItem[], maxFavorites, definitions }
 *   PUT  /api/favorites  -> upsert { items: FavoriteItem[] }
 *
 * Backed by the EAV helpers in src/lib/api/favorites.ts. No new migration:
 * the pinned list lives in the existing health_profile table under
 * section='home_favorites'.
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  getFavorites,
  setFavorites,
  FAVORITE_METRIC_DEFINITIONS,
  MAX_FAVORITES,
  type FavoriteItem,
} from '@/lib/api/favorites'
import { jsonError } from '@/lib/api/json-error'

export const dynamic = 'force-dynamic'

export async function GET() {
  const items = await getFavorites()
  return NextResponse.json({
    items,
    maxFavorites: MAX_FAVORITES,
    definitions: FAVORITE_METRIC_DEFINITIONS,
  })
}

export async function PUT(req: NextRequest) {
  let body: { items?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body.' },
      { status: 400 },
    )
  }

  if (!Array.isArray(body.items)) {
    return NextResponse.json(
      { ok: false, error: 'Missing required field: items (array).' },
      { status: 400 },
    )
  }

  const result = await setFavorites(body.items as FavoriteItem[])
  if (!result.ok) {
    return jsonError(500, 'favorites_save_failed', result.error)
  }
  return NextResponse.json(result)
}
