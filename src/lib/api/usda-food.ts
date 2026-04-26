/**
 * USDA FoodData Central API Client
 *
 * 380K+ verified foods with full nutrient profiles.
 * Free API: https://api.nal.usda.gov/fdc/v1/
 *
 * This replaces user-submitted food databases (MFP) with USDA-verified data.
 * Also enriches with iron absorption context for endo/anemia patients.
 */

import { createServiceClient } from '@/lib/supabase'
import { parseFoodPortions, type FoodPortion } from './usda-portions'

const BASE_URL = 'https://api.nal.usda.gov/fdc/v1'

function getApiKey(): string {
  return process.env.USDA_API_KEY ?? 'DEMO_KEY'
}

// ── Types ──────────────────────────────────────────────────────────

export interface FoodSearchResult {
  fdcId: number
  description: string
  brandName: string | null
  dataType: string // 'Foundation' | 'SR Legacy' | 'Branded' | 'Survey (FNDDS)'
  score: number
  calories: number | null // per 100g (Foundation/SR) or per serving (Branded)
  servingSize: number | null
  servingUnit: string | null
  /** GTIN/UPC for branded foods. Used to cross-reference Open Food Facts
   *  for product photos (USDA itself stores no imagery). Null for
   *  Foundation/SR Legacy/Survey items where the field is absent. */
  gtinUpc: string | null
}

export interface FoodNutrients {
  fdcId: number
  description: string
  /** Brand owner / brand name for branded foods. Null for Foundation,
   *  SR Legacy, and Survey items. Used by the detail-page hero so we
   *  can render brand context under the calorie total. */
  brandName: string | null
  /** GTIN/UPC for branded foods. Null otherwise. Used to cross-
   *  reference Open Food Facts for the hero photo (USDA carries no
   *  imagery itself). */
  gtinUpc: string | null
  calories: number | null
  protein: number | null        // g
  fat: number | null            // g
  satFat: number | null         // g (saturated fatty acids, USDA 1258)
  transFat: number | null       // g (trans fatty acids, USDA 1257)
  cholesterol: number | null    // mg (USDA 1253)
  carbs: number | null          // g
  fiber: number | null          // g
  sugar: number | null          // g
  sodium: number | null         // mg
  iron: number | null           // mg
  calcium: number | null        // mg
  vitaminC: number | null       // mg
  vitaminD: number | null       // mcg
  vitaminB12: number | null     // mcg
  magnesium: number | null      // mg
  zinc: number | null           // mg
  potassium: number | null      // mg
  omega3: number | null         // g (ALA + EPA + DHA)
  folate: number | null         // mcg
  servingSize: number | null    // g
  servingUnit: string | null
  portions: FoodPortion[]       // normalized USDA foodPortions + 100g fallback
}

export interface FoodIronContext {
  ironContent: number | null     // mg per serving
  vitaminCContent: number | null // mg (enhances absorption)
  calciumContent: number | null  // mg (inhibits absorption)
  isHemeIron: boolean            // Animal source = heme (better absorbed)
  absorptionEnhancers: string[]  // Present enhancers
  absorptionInhibitors: string[] // Present inhibitors
  netAbsorptionScore: 'high' | 'medium' | 'low' | 'unknown'
}

/**
 * Thrown when USDA returns 404 for a specific fdcId. Branded foods get
 * retired/replaced when products are reformulated, so a stale fdcId we
 * cached from /foods/search can become invalid before our 7-day cache
 * TTL expires. Callers should treat this as "food not found" rather
 * than a transport error.
 */
export class UsdaFoodNotFoundError extends Error {
  readonly fdcId: number
  constructor(fdcId: number) {
    super(`USDA fdcId ${fdcId} not found (likely a retired branded food).`)
    this.name = 'UsdaFoodNotFoundError'
    this.fdcId = fdcId
  }
}

/**
 * Thrown when USDA is reachable but returns a non-2xx, non-404 status
 * (rate limit, 5xx, 401 from a bad key). Distinct from
 * UsdaFoodNotFoundError so the UI can show "USDA temporarily
 * unavailable" instead of "food not found".
 */
export class UsdaApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'UsdaApiError'
    this.status = status
  }
}

// USDA nutrient IDs (https://fdc.nal.usda.gov/docs/Nutrient-List.pdf)
const NUTRIENT_IDS: Record<string, number> = {
  calories: 1008,
  protein: 1003,
  fat: 1004,
  satFat: 1258,
  transFat: 1257,
  cholesterol: 1253,
  carbs: 1005,
  fiber: 1079,
  sugar: 2000,
  sodium: 1093,
  iron: 1089,
  calcium: 1087,
  vitaminC: 1162,
  vitaminD: 1114,
  vitaminB12: 1178,
  magnesium: 1090,
  zinc: 1095,
  potassium: 1092,
  folate: 1177,
}

// ── Search ─────────────────────────────────────────────────────────

export async function searchFoods(query: string, limit: number = 10): Promise<FoodSearchResult[]> {
  // Check cache first. `v3` suffix busts pre-photo cache entries so
  // results gain the gtinUpc field needed for OFF photo lookup. (v2
  // had bumped for the calorie chip from an earlier PR.)
  const sb = createServiceClient()
  const cacheKey = `search_v3_${query.toLowerCase().trim()}`

  const { data: cached } = await sb
    .from('api_cache')
    .select('response_json')
    .eq('api_name', 'usda')
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (cached?.response_json) {
    return cached.response_json as FoodSearchResult[]
  }

  // Fetch MORE than we need so we can JS-sort by dataType priority:
  // Foundation / SR Legacy / Survey are per-100g (accurate for per-
  // serving math). Branded foods often report per-package nutrients
  // (e.g. 1578 kcal for a whole container of oatmeal), which breaks
  // the portion scaling in /api/food/log. We pull 3x the requested
  // limit, then priority-sort so accurate foods float to the top.
  const apiLimit = Math.min(50, Math.max(limit, limit * 3))
  const res = await fetch(`${BASE_URL}/foods/search?api_key=${getApiKey()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      pageSize: apiLimit,
      dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded'],
    }),
  })

  if (!res.ok) {
    throw new UsdaApiError(res.status, `USDA search failed: ${res.status}`)
  }

  const data = await res.json()
  const TYPE_PRIORITY: Record<string, number> = {
    'Foundation': 0,
    'SR Legacy': 1,
    'Survey (FNDDS)': 2,
    'Branded': 3,
  }
  const rawResults: FoodSearchResult[] = (data.foods ?? []).map((f: Record<string, unknown>) => {
    // USDA /foods/search embeds a per-result foodNutrients array with
    // nutrientId + value pairs (no nested `nutrient` object). Pull the
    // calorie entry so the UI can render per-result calorie chips
    // without a second /food/{id} round trip per result.
    const fn = Array.isArray(f.foodNutrients) ? (f.foodNutrients as Array<Record<string, unknown>>) : []
    const cal = fn.find((n) => Number(n.nutrientId) === NUTRIENT_IDS.calories)
    const calValue = cal ? Number(cal.value) : null
    return {
      fdcId: f.fdcId as number,
      description: f.description as string,
      brandName: (f.brandName as string) ?? (f.brandOwner as string) ?? null,
      dataType: f.dataType as string,
      score: (f.score as number) ?? 0,
      calories: Number.isFinite(calValue) ? Math.round(calValue as number) : null,
      servingSize: typeof f.servingSize === 'number' ? (f.servingSize as number) : null,
      servingUnit: typeof f.servingSizeUnit === 'string' ? (f.servingSizeUnit as string) : null,
      // gtinUpc is only present for Branded items. We pass it through so
      // the search page can do a high-precision Open Food Facts lookup
      // by barcode for the leading-edge product photo.
      gtinUpc: typeof f.gtinUpc === 'string' && (f.gtinUpc as string).length > 0 ? (f.gtinUpc as string) : null,
    }
  })
  const results = rawResults
    .sort((a, b) => {
      const pa = TYPE_PRIORITY[a.dataType] ?? 99
      const pb = TYPE_PRIORITY[b.dataType] ?? 99
      if (pa !== pb) return pa - pb
      return (b.score ?? 0) - (a.score ?? 0) // higher USDA score first within same tier
    })
    .slice(0, limit)

  // Cache for 7 days
  await sb.from('api_cache').upsert({
    api_name: 'usda',
    cache_key: cacheKey,
    response_json: results,
    cached_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }, { onConflict: 'api_name,cache_key' })

  return results
}

// ── Get Nutrients ──────────────────────────────────────────────────

export async function getFoodNutrients(fdcId: number): Promise<FoodNutrients> {
  const sb = createServiceClient()
  const cacheKey = `nutrients_${fdcId}`

  // Check food_nutrient_cache first
  const { data: cached } = await sb
    .from('food_nutrient_cache')
    .select('nutrients')
    .eq('fdc_id', fdcId)
    .maybeSingle()

  if (cached?.nutrients) {
    const cachedNutrients = cached.nutrients as FoodNutrients
    const portions = cachedNutrients.portions
    const hasPortions = Array.isArray(portions) && portions.length > 0
    // Invalidate cache entries that predate the portion-picker feature,
    // and entries cached with the first-pass bad label (the literal
    // "undetermined" sentinel string leaked into some labels before
    // usda-portions#labelFor was taught to strip it).
    const hasStaleLabel = hasPortions &&
      portions.some((p) => typeof p.label === "string" && p.label.includes("undetermined"))
    // Also invalidate if the row was cached before we surfaced satFat /
    // transFat / cholesterol -- detect by presence of the keys. Same
    // for the brand/gtin fields added with the OFF photo integration.
    const missingLabelFields =
      !Object.prototype.hasOwnProperty.call(cachedNutrients, "satFat") ||
      !Object.prototype.hasOwnProperty.call(cachedNutrients, "transFat") ||
      !Object.prototype.hasOwnProperty.call(cachedNutrients, "cholesterol") ||
      !Object.prototype.hasOwnProperty.call(cachedNutrients, "brandName") ||
      !Object.prototype.hasOwnProperty.call(cachedNutrients, "gtinUpc")
    if (hasPortions && !hasStaleLabel && !missingLabelFields) {
      return cachedNutrients
    }
  }

  // USDA's /food/{fdcId} endpoint does NOT support a `nutrients=`
  // filter the way /foods/search does -- if you pass one, it returns
  // an empty foodNutrients array. Removed 2026-04-19 after E2E test
  // confirmed this was why every food was coming back with null calories
  // and empty macros. We fetch all nutrients and pick the fields we
  // care about in the mapping below.
  const res = await fetch(
    `${BASE_URL}/food/${fdcId}?api_key=${getApiKey()}`,
  )

  if (!res.ok) {
    // 404 here can mean two different things:
    //
    // 1. The fdcId is genuinely retired (common for branded foods that
    //    were reformulated; their detail row is gone for good).
    // 2. USDA's per-food endpoint is returning 404 for a food that DOES
    //    still exist in /foods/search. We've confirmed this for several
    //    Foundation foods (e.g. fdcId 748967 "Eggs, Grade A, Large, egg
    //    whole"): /foods/search returns it with a full 95-nutrient
    //    array, but /food/{id} returns 404. This is a USDA-side
    //    inconsistency, not a stale id.
    //
    // Before giving up, try a /foods/search reverse-lookup using the
    // fdcId as the query string (USDA accepts numeric fdcId queries and
    // returns exactly the matching food when the id is valid). If that
    // hit comes back with nutrients, hydrate from it. Only after BOTH
    // endpoints fail do we throw UsdaFoodNotFoundError.
    if (res.status === 404) {
      const fallback = await fetchNutrientsViaSearch(fdcId).catch(() => null)
      if (fallback) {
        await sb.from('food_nutrient_cache').upsert({
          food_term: fallback.description.toLowerCase(),
          fdc_id: fdcId,
          nutrients: fallback,
        }, { onConflict: 'fdc_id' })
        return fallback
      }
      // Best-effort: drop any stale food_nutrient_cache row for this
      // id so a future fix on USDA's side doesn't get masked. Failure
      // is non-fatal -- the throw below is the user-facing signal.
      await sb.from('food_nutrient_cache').delete().eq('fdc_id', fdcId).then(
        () => undefined,
        () => undefined,
      )
      throw new UsdaFoodNotFoundError(fdcId)
    }
    throw new UsdaApiError(res.status, `USDA nutrient fetch failed: ${res.status}`)
  }

  const data = await res.json()
  const result = mapFoodDetailResponse(fdcId, data)

  // Cache in food_nutrient_cache
  await sb.from('food_nutrient_cache').upsert({
    food_term: result.description.toLowerCase(),
    fdc_id: fdcId,
    nutrients: result,
  }, { onConflict: 'fdc_id' })

  return result
}

// ── Mapping helpers ────────────────────────────────────────────────

/**
 * Map a USDA `/food/{fdcId}` payload (the per-food detail shape) into
 * our normalized `FoodNutrients`. The detail payload nests each
 * nutrient as `{ nutrient: { id }, amount }`.
 */
function mapFoodDetailResponse(
  fdcId: number,
  data: Record<string, unknown>,
): FoodNutrients {
  const rawNutrients = Array.isArray(data.foodNutrients)
    ? (data.foodNutrients as Array<{ nutrient?: { id?: number }; amount?: number }>)
    : []

  const getNutrient = (id: number): number | null => {
    const n = rawNutrients.find((row) => row?.nutrient?.id === id)
    if (!n || typeof n.amount !== 'number' || !Number.isFinite(n.amount)) return null
    return Math.round(n.amount * 10) / 10
  }

  const servingSize = typeof data.servingSize === 'number' ? data.servingSize : null
  const servingUnit = typeof data.servingSizeUnit === 'string' ? data.servingSizeUnit : null
  const servingInfo = servingSize !== null
    ? { servingSize, servingUnit: servingUnit ?? 'g' }
    : { servingSize: 100, servingUnit: 'g' }

  const portions = parseFoodPortions(data.foodPortions)

  return {
    fdcId,
    description: typeof data.description === 'string' ? data.description : '',
    brandName:
      typeof data.brandName === 'string' && data.brandName.length > 0
        ? data.brandName
        : typeof data.brandOwner === 'string' && data.brandOwner.length > 0
          ? (data.brandOwner as string)
          : null,
    gtinUpc:
      typeof data.gtinUpc === 'string' && (data.gtinUpc as string).length > 0
        ? (data.gtinUpc as string)
        : null,
    calories: getNutrient(NUTRIENT_IDS.calories),
    protein: getNutrient(NUTRIENT_IDS.protein),
    fat: getNutrient(NUTRIENT_IDS.fat),
    satFat: getNutrient(NUTRIENT_IDS.satFat),
    transFat: getNutrient(NUTRIENT_IDS.transFat),
    cholesterol: getNutrient(NUTRIENT_IDS.cholesterol),
    carbs: getNutrient(NUTRIENT_IDS.carbs),
    fiber: getNutrient(NUTRIENT_IDS.fiber),
    sugar: getNutrient(NUTRIENT_IDS.sugar),
    sodium: getNutrient(NUTRIENT_IDS.sodium),
    iron: getNutrient(NUTRIENT_IDS.iron),
    calcium: getNutrient(NUTRIENT_IDS.calcium),
    vitaminC: getNutrient(NUTRIENT_IDS.vitaminC),
    vitaminD: getNutrient(NUTRIENT_IDS.vitaminD),
    vitaminB12: getNutrient(NUTRIENT_IDS.vitaminB12),
    magnesium: getNutrient(NUTRIENT_IDS.magnesium),
    zinc: getNutrient(NUTRIENT_IDS.zinc),
    potassium: getNutrient(NUTRIENT_IDS.potassium),
    omega3: null, // USDA doesn't have a single omega-3 total field
    folate: getNutrient(NUTRIENT_IDS.folate),
    servingSize: servingInfo.servingSize,
    servingUnit: servingInfo.servingUnit,
    portions,
  }
}

/**
 * Map a USDA `/foods/search` food entry into our normalized
 * `FoodNutrients`. The search payload differs from the detail payload:
 * each nutrient row is `{ nutrientId, value }` (flat), not nested
 * under a `nutrient` object. Used as a fallback when `/food/{id}` 404s
 * for foods that still exist in search.
 */
function mapSearchFoodEntry(
  fdcId: number,
  food: Record<string, unknown>,
): FoodNutrients {
  const rawNutrients = Array.isArray(food.foodNutrients)
    ? (food.foodNutrients as Array<{ nutrientId?: number; value?: number }>)
    : []

  const getNutrient = (id: number): number | null => {
    const n = rawNutrients.find((row) => Number(row?.nutrientId) === id)
    if (!n || typeof n.value !== 'number' || !Number.isFinite(n.value)) return null
    return Math.round(n.value * 10) / 10
  }

  const servingSize = typeof food.servingSize === 'number' ? food.servingSize : null
  const servingUnit = typeof food.servingSizeUnit === 'string' ? food.servingSizeUnit : null
  // Foundation/SR Legacy/Survey foods are reported per 100g when
  // servingSize is absent. Branded foods always carry a serving size.
  const servingInfo = servingSize !== null
    ? { servingSize, servingUnit: servingUnit ?? 'g' }
    : { servingSize: 100, servingUnit: 'g' }

  const portions = parseFoodPortions(food.foodPortions)

  return {
    fdcId,
    description: typeof food.description === 'string' ? food.description : '',
    brandName:
      typeof food.brandName === 'string' && food.brandName.length > 0
        ? food.brandName
        : typeof food.brandOwner === 'string' && food.brandOwner.length > 0
          ? (food.brandOwner as string)
          : null,
    gtinUpc:
      typeof food.gtinUpc === 'string' && (food.gtinUpc as string).length > 0
        ? (food.gtinUpc as string)
        : null,
    calories: getNutrient(NUTRIENT_IDS.calories),
    protein: getNutrient(NUTRIENT_IDS.protein),
    fat: getNutrient(NUTRIENT_IDS.fat),
    satFat: getNutrient(NUTRIENT_IDS.satFat),
    transFat: getNutrient(NUTRIENT_IDS.transFat),
    cholesterol: getNutrient(NUTRIENT_IDS.cholesterol),
    carbs: getNutrient(NUTRIENT_IDS.carbs),
    fiber: getNutrient(NUTRIENT_IDS.fiber),
    sugar: getNutrient(NUTRIENT_IDS.sugar),
    sodium: getNutrient(NUTRIENT_IDS.sodium),
    iron: getNutrient(NUTRIENT_IDS.iron),
    calcium: getNutrient(NUTRIENT_IDS.calcium),
    vitaminC: getNutrient(NUTRIENT_IDS.vitaminC),
    vitaminD: getNutrient(NUTRIENT_IDS.vitaminD),
    vitaminB12: getNutrient(NUTRIENT_IDS.vitaminB12),
    magnesium: getNutrient(NUTRIENT_IDS.magnesium),
    zinc: getNutrient(NUTRIENT_IDS.zinc),
    potassium: getNutrient(NUTRIENT_IDS.potassium),
    omega3: null,
    folate: getNutrient(NUTRIENT_IDS.folate),
    servingSize: servingInfo.servingSize,
    servingUnit: servingInfo.servingUnit,
    portions,
  }
}

/**
 * Fallback: query `/foods/search?query=<fdcId>` and map the matching
 * entry. USDA accepts numeric fdcId queries and returns at most one
 * food when the id is valid. Returns null if the search has zero hits
 * or the matching food's nutrient row is empty.
 *
 * Why this exists:
 *   USDA's per-food detail endpoint (`/food/{fdcId}`) returns 404 for
 *   several active Foundation foods (eggs, egg whites, egg yolks among
 *   them) even though the same fdcId resolves cleanly through the
 *   search endpoint. Without this fallback, clicking those foods from
 *   the search list shows a "Food not found" stub instead of the
 *   nutrition card. Reproduced 2026-04-26 against fdcId 748967.
 */
async function fetchNutrientsViaSearch(fdcId: number): Promise<FoodNutrients | null> {
  const res = await fetch(`${BASE_URL}/foods/search?api_key=${getApiKey()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: String(fdcId), pageSize: 5 }),
  })
  if (!res.ok) return null
  const data = await res.json() as { foods?: Array<Record<string, unknown>> }
  const foods = Array.isArray(data.foods) ? data.foods : []
  // USDA may return multiple results when the numeric query matches by
  // text; pick the entry whose fdcId actually equals the one we want.
  const match = foods.find((f) => Number((f as { fdcId?: unknown }).fdcId) === fdcId)
  if (!match) return null
  const mapped = mapSearchFoodEntry(fdcId, match)
  // Calories is the cheapest signal for "we got real nutrients back."
  // Return null if the search row was a stub so the caller throws
  // UsdaFoodNotFoundError and the UI shows the standard not-found card.
  if (mapped.calories === null && mapped.protein === null && mapped.carbs === null) {
    return null
  }
  return mapped
}

// ── Iron Absorption Context (for endo/anemia patients) ─────────────

export function analyzeIronAbsorption(nutrients: FoodNutrients): FoodIronContext {
  const iron = nutrients.iron ?? 0
  const vitC = nutrients.vitaminC ?? 0
  const calcium = nutrients.calcium ?? 0

  // Heuristic: animal products (high protein, B12 present) have heme iron
  const isHemeIron = (nutrients.vitaminB12 ?? 0) > 0 && (nutrients.protein ?? 0) > 10

  const enhancers: string[] = []
  const inhibitors: string[] = []

  if (vitC > 10) enhancers.push('Vitamin C')
  if (isHemeIron) enhancers.push('Heme iron (animal source)')

  if (calcium > 100) inhibitors.push('Calcium')
  // Tannins, phytates, and oxalates can't be detected from macros alone

  let score: FoodIronContext['netAbsorptionScore'] = 'unknown'
  if (iron > 0) {
    if (enhancers.length > 0 && inhibitors.length === 0) score = 'high'
    else if (enhancers.length > 0 && inhibitors.length > 0) score = 'medium'
    else if (inhibitors.length > 0 && enhancers.length === 0) score = 'low'
    else score = 'medium'
  }

  return {
    ironContent: iron,
    vitaminCContent: vitC,
    calciumContent: calcium,
    isHemeIron,
    absorptionEnhancers: enhancers,
    absorptionInhibitors: inhibitors,
    netAbsorptionScore: score,
  }
}
