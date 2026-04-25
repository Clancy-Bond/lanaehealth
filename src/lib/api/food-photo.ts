/**
 * Food photo lookup
 *
 * USDA FoodData Central does not include food photos -- their mandate
 * is nutrient data, not imagery. Open Food Facts (already integrated
 * for barcode lookup at `./open-food-facts.ts`) ships a CC-BY-SA photo
 * for the vast majority of branded items. This helper bridges the two:
 * given a USDA fdcId + name (+ optional GTIN), return a photo URL
 * sourced from OFF, cached 30 days in `api_cache`.
 *
 * Cache strategy:
 *   - Key: `photo_v1_${fdcId}` (per USDA id, since the same dish can
 *     appear with very different photos depending on brand)
 *   - TTL: 30 days. Photos rarely change for a given product. Bumping
 *     to v2 would re-trigger a lookup if we change the resolution we
 *     pull (small vs. large) or switch sources.
 *   - Negative cache: misses are also cached (with `url: null`) so we
 *     do not retry OFF for foods we already know are not photographed.
 *     Still 30 days. Branded packaging gets photographed by the OFF
 *     community over time, but the cache miss cost is low and a 30-day
 *     refresh window is fine.
 *
 * Hit-rate planning (per /tmp/food-database-research.md):
 *   - Branded: ~85% hit via GTIN
 *   - Survey/FNDDS (raw foods, mixed dishes): ~30% via name search
 *   - Foundation/SR Legacy: ~25%
 *   - Weighted blend across a typical food log: ~60-70%.
 */

import { createServiceClient } from '@/lib/supabase'

const CACHE_TTL_DAYS = 30
const OFF_BASE = 'https://world.openfoodfacts.org/api/v2'

export interface FoodPhotoLookup {
  url: string | null
  source: 'off' | null
}

interface CachedShape {
  url: string | null
  source: 'off' | null
}

/**
 * Look up a food photo for a USDA-sourced food. Returns null when no
 * photo is available from any free source.
 *
 * @param fdcId  USDA FoodData Central id; used as the cache key.
 * @param name   Food description used for fallback name search.
 * @param gtin   Optional GTIN/UPC. When present we try a direct OFF
 *               barcode lookup first (much higher precision than
 *               name search).
 */
export async function lookupFoodPhoto(
  fdcId: number | string,
  name: string,
  gtin?: string | null,
): Promise<FoodPhotoLookup> {
  const sb = createServiceClient()
  const cacheKey = `photo_v1_${String(fdcId)}`

  // Cache check. Negative results (`url: null`) are intentionally
  // cached too -- see header comment.
  const { data: cached } = await sb
    .from('api_cache')
    .select('response_json')
    .eq('api_name', 'food_photo')
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (cached?.response_json) {
    const c = cached.response_json as CachedShape
    return { url: c.url ?? null, source: c.source ?? null }
  }

  // Live lookup. GTIN-first, name-fallback.
  let result: FoodPhotoLookup = { url: null, source: null }

  if (gtin) {
    const url = await lookupByGtin(gtin).catch(() => null)
    if (url) result = { url, source: 'off' }
  }

  if (!result.url) {
    const url = await lookupByName(name).catch(() => null)
    if (url) result = { url, source: 'off' }
  }

  // Write-through cache (positive or negative).
  await sb
    .from('api_cache')
    .upsert(
      {
        api_name: 'food_photo',
        cache_key: cacheKey,
        response_json: result,
        cached_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: 'api_name,cache_key' },
    )
    .then(
      () => undefined,
      () => undefined, // cache write failures must never bubble
    )

  return result
}

/**
 * Batch variant. Useful for the search-results list, where we need
 * many photos at once. Reads cache per-id in parallel; live lookups
 * for missing ids are also parallelized but capped via Promise.all.
 *
 * Returns a map keyed by fdcId so callers can render in any order.
 */
export async function lookupFoodPhotos(
  items: Array<{ fdcId: number | string; name: string; gtin?: string | null }>,
): Promise<Map<string, FoodPhotoLookup>> {
  const out = new Map<string, FoodPhotoLookup>()
  const sb = createServiceClient()
  const keys = items.map((it) => `photo_v1_${String(it.fdcId)}`)

  // Cache batch read. One round trip instead of N.
  const { data: rows } = await sb
    .from('api_cache')
    .select('cache_key,response_json,expires_at')
    .eq('api_name', 'food_photo')
    .in('cache_key', keys)

  const nowISO = new Date().toISOString()
  const cachedKeys = new Set<string>()
  if (rows) {
    for (const row of rows) {
      if ((row.expires_at as string) > nowISO) {
        const c = row.response_json as CachedShape
        out.set(String(row.cache_key).replace('photo_v1_', ''), {
          url: c.url ?? null,
          source: c.source ?? null,
        })
        cachedKeys.add(row.cache_key as string)
      }
    }
  }

  // Live lookups for the misses, in parallel. The per-call function
  // also writes the cache, so we don't need a separate write pass.
  const missing = items.filter((it) => !cachedKeys.has(`photo_v1_${String(it.fdcId)}`))
  const results = await Promise.all(
    missing.map(async (it) => {
      const r = await lookupFoodPhoto(it.fdcId, it.name, it.gtin).catch(
        () => ({ url: null, source: null } as FoodPhotoLookup),
      )
      return { fdcId: String(it.fdcId), r }
    }),
  )
  for (const { fdcId, r } of results) out.set(fdcId, r)

  return out
}

/**
 * Name-only batch variant. Used by surfaces where we have a free-text
 * food label but no USDA fdcId (e.g. logged meal entries -- the
 * food_entries table stores `food_items` as text and lacks an fdcId
 * column). Cache key is derived from a hash of the lowercased name so
 * "Greek yogurt" and "greek yogurt" share an entry. 30-day TTL, same
 * as the fdcId-keyed variant.
 */
export async function lookupFoodPhotosByName(
  names: string[],
): Promise<Map<string, FoodPhotoLookup>> {
  const out = new Map<string, FoodPhotoLookup>()
  const sb = createServiceClient()
  const dedup = Array.from(new Set(names.map(normalizeName).filter((n) => n.length >= 3)))
  if (dedup.length === 0) return out

  const keys = dedup.map((n) => `photo_byname_v1_${nameHashKey(n)}`)
  const { data: rows } = await sb
    .from('api_cache')
    .select('cache_key,response_json,expires_at')
    .eq('api_name', 'food_photo')
    .in('cache_key', keys)

  const nowISO = new Date().toISOString()
  const cachedKeyMap = new Map<string, FoodPhotoLookup>()
  if (rows) {
    for (const row of rows) {
      if ((row.expires_at as string) > nowISO) {
        const c = row.response_json as CachedShape
        cachedKeyMap.set(row.cache_key as string, {
          url: c.url ?? null,
          source: c.source ?? null,
        })
      }
    }
  }

  // Look up the misses in parallel, then write through.
  await Promise.all(
    dedup.map(async (name) => {
      const cacheKey = `photo_byname_v1_${nameHashKey(name)}`
      const cachedHit = cachedKeyMap.get(cacheKey)
      if (cachedHit !== undefined) {
        out.set(name, cachedHit)
        return
      }
      const url = await lookupByName(name).catch(() => null)
      const result: FoodPhotoLookup = url ? { url, source: 'off' } : { url: null, source: null }
      out.set(name, result)
      await sb
        .from('api_cache')
        .upsert(
          {
            api_name: 'food_photo',
            cache_key: cacheKey,
            response_json: result,
            cached_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
          },
          { onConflict: 'api_name,cache_key' },
        )
        .then(
          () => undefined,
          () => undefined,
        )
    }),
  )

  return out
}

function normalizeName(s: string): string {
  return (s ?? '').trim().toLowerCase()
}

// Tiny djb2 hash, then base36. Cache keys stay short and deterministic
// across processes. Collisions are theoretically possible but cost is
// "wrong photo for that food's first cache request" which is fine for
// a non-critical visual element.
function nameHashKey(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

// ── Internal: OFF transport ──────────────────────────────────────────

async function lookupByGtin(gtin: string): Promise<string | null> {
  const trimmed = gtin.trim()
  if (!trimmed) return null
  const res = await fetch(`${OFF_BASE}/product/${encodeURIComponent(trimmed)}.json?fields=image_front_small_url,image_front_url,image_url`, {
    headers: { 'User-Agent': 'LanaeHealth/1.0 (food-photo-lookup)' },
  })
  if (!res.ok) return null
  const data = await res.json().catch(() => null)
  if (!data || data.status !== 1 || !data.product) return null
  const p = data.product as Record<string, unknown>
  return pickPhotoUrl(p)
}

async function lookupByName(name: string): Promise<string | null> {
  const trimmed = name.trim()
  if (trimmed.length < 3) return null
  const params = new URLSearchParams({
    search_terms: trimmed,
    page_size: '1',
    json: '1',
    fields: 'image_front_small_url,image_front_url,image_url',
  })
  // Try /api/v2/search first; if OFF returns degraded HTML (they
  // rate-limit by serving a "temporarily unavailable" page rather than
  // a JSON 503), fall back to /cgi/search.pl which is the legacy
  // endpoint and tends to stay up. Both accept the same params.
  const v2 = await tryFetchOffJson(`${OFF_BASE}/search?${params.toString()}`)
  if (v2) {
    const url = pickPhotoFromSearch(v2)
    if (url) return url
  }
  const cgi = await tryFetchOffJson(
    `https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`,
  )
  if (cgi) {
    const url = pickPhotoFromSearch(cgi)
    if (url) return url
  }
  return null
}

async function tryFetchOffJson(url: string): Promise<unknown | null> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'LanaeHealth/1.0 (food-photo-lookup)',
      Accept: 'application/json',
    },
  })
  if (!res.ok) return null
  // OFF degrades to HTML under load (200 OK with an HTML page). Sniff
  // the content-type and bail if it isn't JSON.
  const ct = res.headers.get('content-type') ?? ''
  if (!ct.includes('json')) return null
  return res.json().catch(() => null)
}

function pickPhotoFromSearch(data: unknown): string | null {
  const products = (data as { products?: Array<Record<string, unknown>> } | null)?.products ?? []
  if (products.length === 0) return null
  return pickPhotoUrl(products[0])
}

function pickPhotoUrl(p: Record<string, unknown>): string | null {
  // Prefer the small variant for list rows. The detail-page hero
  // re-uses this same lookup; list-row size is acceptable for hero
  // at typical mobile widths and avoids a second API call.
  const small = p.image_front_small_url as string | undefined
  if (small) return small
  const front = p.image_front_url as string | undefined
  if (front) return front
  const generic = p.image_url as string | undefined
  return generic ?? null
}
