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
import { z } from 'zod'
import {
  getFavorites,
  setFavorites,
  FAVORITE_METRIC_DEFINITIONS,
  MAX_FAVORITES,
  type FavoriteItem,
} from '@/lib/api/favorites'
import { jsonError } from '@/lib/api/json-error'

// A FavoriteItem is `{ metric: FavoriteMetricId }` today. Keep the
// schema permissive on the discriminator (the lib layer validates
// against the authoritative `FAVORITE_METRIC_DEFINITIONS` id set).
const ItemSchema = z.object({ metric: z.string().min(1) }).passthrough()
const BodySchema = z.object({
  items: z.array(ItemSchema).max(MAX_FAVORITES),
})

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
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return jsonError(400, 'bad_body')
  }

  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return jsonError(400, 'favorites_invalid', parsed.error)
  }

  const result = await setFavorites(parsed.data.items as FavoriteItem[])
  if (!result.ok) {
    return jsonError(500, 'favorites_save_failed', result.error)
  }
  return NextResponse.json(result)
}
