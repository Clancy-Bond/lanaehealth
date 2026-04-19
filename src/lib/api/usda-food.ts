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
}

export interface FoodNutrients {
  fdcId: number
  description: string
  calories: number | null
  protein: number | null        // g
  fat: number | null            // g
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

// USDA nutrient IDs
const NUTRIENT_IDS: Record<string, number> = {
  calories: 1008,
  protein: 1003,
  fat: 1004,
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
  // Check cache first
  const sb = createServiceClient()
  const cacheKey = `search_${query.toLowerCase().trim()}`

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
    throw new Error(`USDA search failed: ${res.status}`)
  }

  const data = await res.json()
  const TYPE_PRIORITY: Record<string, number> = {
    'Foundation': 0,
    'SR Legacy': 1,
    'Survey (FNDDS)': 2,
    'Branded': 3,
  }
  const rawResults: FoodSearchResult[] = (data.foods ?? []).map((f: Record<string, unknown>) => ({
    fdcId: f.fdcId as number,
    description: f.description as string,
    brandName: (f.brandName as string) ?? (f.brandOwner as string) ?? null,
    dataType: f.dataType as string,
    score: f.score as number ?? 0,
  }))
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
    return cached.nutrients as FoodNutrients
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
    throw new Error(`USDA nutrient fetch failed: ${res.status}`)
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

  const servingInfo = data.servingSize
    ? { servingSize: data.servingSize, servingUnit: data.servingSizeUnit ?? 'g' }
    : { servingSize: 100, servingUnit: 'g' }

  const result: FoodNutrients = {
    fdcId,
    description: data.description ?? '',
    calories: getNutrient(NUTRIENT_IDS.calories),
    protein: getNutrient(NUTRIENT_IDS.protein),
    fat: getNutrient(NUTRIENT_IDS.fat),
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
