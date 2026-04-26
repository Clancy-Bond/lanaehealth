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
  // v4 busts entries cached before the Atwater (2047/2048) calorie
  // fallback: those entries set `calories: null` for Foundation foods.
  const cacheKey = `search_v4_${query.toLowerCase().trim()}`

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
    // Try Branded "Energy" (1008) first; fall back to Atwater factor
    // ids that Foundation / SR Legacy use. Without the fallback the
    // "X cal" chip on staples like flour/oats/rice always reads 0.
    const cal =
      fn.find((n) => Number(n.nutrientId) === NUTRIENT_IDS.calories) ??
      fn.find((n) => Number(n.nutrientId) === 2047) ??
      fn.find((n) => Number(n.nutrientId) === 2048)
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
    // Foundation calorie fallback: rows cached before the Atwater
    // (2047/2048) lookup show calories=null for Foundation foods that
    // do have Atwater Energy. Invalidate so the recipe builder gets
    // the real number on the next read.
    const isFoundationLike = !cachedNutrients.brandName
    const hasAtwaterCalsMissing = isFoundationLike && cachedNutrients.calories === null
    if (hasPortions && !hasStaleLabel && !missingLabelFields && !hasAtwaterCalsMissing) {
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
    // 404 = stale fdcId (retired branded product). Distinct from
    // 5xx/rate-limit so callers can render "food not found" instead
    // of "USDA temporarily unavailable".
    if (res.status === 404) {
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
  const nutrients = data.foodNutrients as Array<{
    nutrient: { id: number }
    amount: number
  }> ?? []

  const getNutrient = (id: number): number | null => {
    const n = nutrients.find(n => n.nutrient.id === id)
    return n ? Math.round(n.amount * 10) / 10 : null
  }

  // Foundation / SR Legacy foods often expose Energy under
  // id 2047 (Atwater General) or 2048 (Atwater Specific) rather than
  // 1008 (the Branded "Energy"). Without this fallback the recipe
  // builder shows "0 cal" on staples like flour, oats, rice, beans.
  // Branded foods continue to resolve via 1008.
  const getCalories = (): number | null => {
    return (
      getNutrient(NUTRIENT_IDS.calories) ??
      getNutrient(2047) ??
      getNutrient(2048)
    )
  }

  const servingInfo = data.servingSize
    ? { servingSize: data.servingSize, servingUnit: data.servingSizeUnit ?? 'g' }
    : { servingSize: 100, servingUnit: 'g' }

  const portions = parseFoodPortions(data.foodPortions)

  const result: FoodNutrients = {
    fdcId,
    description: data.description ?? '',
    brandName:
      typeof data.brandName === 'string' && data.brandName.length > 0
        ? data.brandName
        : typeof data.brandOwner === 'string' && data.brandOwner.length > 0
          ? data.brandOwner
          : null,
    gtinUpc:
      typeof data.gtinUpc === 'string' && data.gtinUpc.length > 0
        ? data.gtinUpc
        : null,
    calories: getCalories(),
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

  // Cache in food_nutrient_cache
  await sb.from('food_nutrient_cache').upsert({
    food_term: result.description.toLowerCase(),
    fdc_id: fdcId,
    nutrients: result,
  }, { onConflict: 'fdc_id' })

  return result
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
