/**
 * Recipes API.
 *
 * Three sources:
 *   'edamam'      - Edamam Recipe Search API (2.3M recipes,
 *                   needs EDAMAM_APP_ID + EDAMAM_APP_KEY env vars).
 *   'user_url'    - imported from a user-pasted URL via schema.org
 *                   recipe parsing.
 *   'user_custom' - hand-entered, lives in the legacy
 *                   health_profile.section='recipes' store.
 */

import { createServiceClient } from '@/lib/supabase'

export type RecipeSource = 'edamam' | 'user_url' | 'user_custom'

export interface RecipeIngredientLine {
  raw: string
  name?: string
  amount?: string
  unit?: string
}

export interface RecipeNutritionPerServing {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber?: number
  sugar?: number
  sodium?: number
}

export interface Recipe {
  id: string
  source: RecipeSource
  sourceId?: string
  name: string
  imageUrl?: string
  servings: number
  caloriesPerServing: number
  ingredients: RecipeIngredientLine[]
  nutritionPerServing: RecipeNutritionPerServing
  totalTimeMinutes?: number
  url?: string
  cuisine?: string
  dietLabels?: string[]
  healthLabels?: string[]
}

const EDAMAM_BASE = 'https://api.edamam.com/api/recipes/v2'

export interface EdamamConfig {
  appId: string | null
  appKey: string | null
}

export function readEdamamConfig(): EdamamConfig {
  return {
    appId: process.env.EDAMAM_APP_ID ?? null,
    appKey: process.env.EDAMAM_APP_KEY ?? null,
  }
}

export function isEdamamConfigured(): boolean {
  const c = readEdamamConfig()
  return Boolean(c.appId && c.appKey)
}

interface EdamamHitRecipe {
  uri?: string
  label?: string
  image?: string
  source?: string
  url?: string
  yield?: number
  totalTime?: number
  cuisineType?: string[]
  dietLabels?: string[]
  healthLabels?: string[]
  ingredientLines?: string[]
  ingredients?: Array<{ text?: string; food?: string; quantity?: number; measure?: string }>
  totalNutrients?: Record<string, { quantity?: number } | undefined>
  calories?: number
}

interface EdamamSearchResponse {
  hits?: Array<{ recipe?: EdamamHitRecipe }>
}

function nutrient(
  totals: Record<string, { quantity?: number } | undefined> | undefined,
  key: string,
  servings: number,
): number {
  const raw = totals?.[key]?.quantity
  if (!Number.isFinite(raw) || !raw) return 0
  const s = Math.max(1, servings)
  return Number((raw / s).toFixed(1))
}

function recipeFromEdamam(hit: EdamamHitRecipe): Recipe {
  const servings = Math.max(1, Math.round(hit.yield ?? 1))
  const calories = (hit.calories ?? 0) / servings
  const tn = hit.totalNutrients
  const ingredientLines: RecipeIngredientLine[] = Array.isArray(hit.ingredients)
    ? hit.ingredients.map((i) => ({
        raw: i.text ?? '',
        name: i.food,
        amount: typeof i.quantity === 'number' ? String(i.quantity) : undefined,
        unit: i.measure,
      }))
    : (hit.ingredientLines ?? []).map((line) => ({ raw: line }))

  return {
    id: hit.uri ?? hit.url ?? `edamam_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    source: 'edamam',
    sourceId: hit.uri,
    name: hit.label ?? 'Untitled recipe',
    imageUrl: hit.image,
    servings,
    caloriesPerServing: Math.round(calories),
    ingredients: ingredientLines,
    nutritionPerServing: {
      calories: Math.round(calories),
      protein: nutrient(tn, 'PROCNT', servings),
      carbs: nutrient(tn, 'CHOCDF', servings),
      fat: nutrient(tn, 'FAT', servings),
      fiber: nutrient(tn, 'FIBTG', servings),
      sugar: nutrient(tn, 'SUGAR', servings),
      sodium: nutrient(tn, 'NA', servings),
    },
    totalTimeMinutes: hit.totalTime && hit.totalTime > 0 ? hit.totalTime : undefined,
    url: hit.url,
    cuisine: Array.isArray(hit.cuisineType) && hit.cuisineType.length > 0 ? hit.cuisineType[0] : undefined,
    dietLabels: hit.dietLabels,
    healthLabels: hit.healthLabels,
  }
}

export async function searchRecipes(query: string, limit = 12): Promise<Recipe[]> {
  if (!query.trim()) return []
  const cfg = readEdamamConfig()
  if (!cfg.appId || !cfg.appKey) return []

  const params = new URLSearchParams({
    type: 'public',
    q: query.trim(),
    app_id: cfg.appId,
    app_key: cfg.appKey,
    random: 'false',
  })
  const url = `${EDAMAM_BASE}?${params}`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'LanaeHealth/1.0 (health-tracking-app)' },
    })
    if (!res.ok) return []
    const data = (await res.json()) as EdamamSearchResponse
    const hits = Array.isArray(data.hits) ? data.hits : []
    return hits
      .map((h) => h.recipe)
      .filter((r): r is EdamamHitRecipe => Boolean(r))
      .slice(0, limit)
      .map(recipeFromEdamam)
  } catch {
    return []
  }
}

export async function fetchEdamamRecipe(uri: string): Promise<Recipe | null> {
  const cfg = readEdamamConfig()
  if (!cfg.appId || !cfg.appKey) return null

  const id = encodeURIComponent(uri)
  const params = new URLSearchParams({
    type: 'public',
    app_id: cfg.appId,
    app_key: cfg.appKey,
  })
  const url = `${EDAMAM_BASE}/${id}?${params}`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'LanaeHealth/1.0 (health-tracking-app)' },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { recipe?: EdamamHitRecipe }
    if (!data.recipe) return null
    return recipeFromEdamam(data.recipe)
  } catch {
    return null
  }
}

interface SchemaOrgRecipe {
  name?: string
  image?: string | string[] | { url?: string }
  recipeIngredient?: string[]
  ingredients?: string[]
  recipeYield?: string | number | string[]
  totalTime?: string
  url?: string
  recipeCuisine?: string | string[]
  nutrition?: {
    calories?: string | number
    proteinContent?: string | number
    carbohydrateContent?: string | number
    fatContent?: string | number
    fiberContent?: string | number
    sugarContent?: string | number
    sodiumContent?: string | number
  }
}

function parseDurationISO(s: string | undefined): number | undefined {
  if (!s) return undefined
  const h = /([0-9]+)H/i.exec(s)?.[1]
  const m = /([0-9]+)M/i.exec(s)?.[1]
  const total = (h ? Number(h) * 60 : 0) + (m ? Number(m) : 0)
  return total > 0 ? total : undefined
}

function parseYield(raw: string | number | string[] | undefined): number {
  if (Array.isArray(raw)) raw = raw[0]
  if (typeof raw === 'number') return Math.max(1, Math.round(raw))
  if (typeof raw !== 'string') return 1
  const m = /([0-9]+)/.exec(raw)
  return m ? Math.max(1, Number(m[1])) : 1
}

function parseNumber(raw: string | number | undefined): number {
  if (typeof raw === 'number') return raw
  if (typeof raw !== 'string') return 0
  const m = /([0-9.]+)/.exec(raw)
  return m ? Number(m[1]) : 0
}

function parseImage(raw: SchemaOrgRecipe['image']): string | undefined {
  if (!raw) return undefined
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw)) return typeof raw[0] === 'string' ? raw[0] : undefined
  if (typeof raw === 'object' && typeof raw.url === 'string') return raw.url
  return undefined
}

function findRecipeNode(json: unknown): SchemaOrgRecipe | null {
  if (!json || typeof json !== 'object') return null
  const visit = (node: unknown): SchemaOrgRecipe | null => {
    if (!node || typeof node !== 'object') return null
    const n = node as Record<string, unknown>
    const t = n['@type']
    const types = Array.isArray(t) ? t : [t]
    if (types.includes('Recipe')) return n as unknown as SchemaOrgRecipe
    if (Array.isArray(n['@graph'])) {
      for (const child of n['@graph']) {
        const found = visit(child)
        if (found) return found
      }
    }
    return null
  }
  if (Array.isArray(json)) {
    for (const node of json) {
      const found = visit(node)
      if (found) return found
    }
    return null
  }
  return visit(json)
}

export async function importRecipeFromUrl(url: string): Promise<Recipe | null> {
  let html: string
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LanaeHealth/1.0; +https://lanaehealth.app)',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!res.ok) return null
    html = await res.text()
  } catch {
    return null
  }

  const scriptRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  let recipe: SchemaOrgRecipe | null = null
  while ((match = scriptRe.exec(html))) {
    try {
      const parsed = JSON.parse(match[1].trim())
      const found = findRecipeNode(parsed)
      if (found) {
        recipe = found
        break
      }
    } catch {
      // ignore
    }
  }
  if (!recipe) return null

  const servings = parseYield(recipe.recipeYield)
  const calories = Math.round(parseNumber(recipe.nutrition?.calories))
  const ingredients = (recipe.recipeIngredient ?? recipe.ingredients ?? []).map(
    (line) => ({ raw: String(line) }),
  )

  const cuisine = Array.isArray(recipe.recipeCuisine)
    ? recipe.recipeCuisine[0]
    : (recipe.recipeCuisine as string | undefined)

  return {
    id: `url_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    source: 'user_url',
    sourceId: url,
    name: recipe.name ?? 'Imported recipe',
    imageUrl: parseImage(recipe.image),
    servings,
    caloriesPerServing: calories,
    ingredients,
    nutritionPerServing: {
      calories,
      protein: parseNumber(recipe.nutrition?.proteinContent),
      carbs: parseNumber(recipe.nutrition?.carbohydrateContent),
      fat: parseNumber(recipe.nutrition?.fatContent),
      fiber: parseNumber(recipe.nutrition?.fiberContent),
      sugar: parseNumber(recipe.nutrition?.sugarContent),
      sodium: parseNumber(recipe.nutrition?.sodiumContent),
    },
    totalTimeMinutes: parseDurationISO(recipe.totalTime),
    url,
    cuisine,
  }
}

interface UserRecipeRow {
  id: string
  source: RecipeSource
  source_id: string | null
  name: string
  data: Recipe
  created_at: string
}

export async function listSavedRecipes(): Promise<Recipe[]> {
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('user_recipes')
      .select('id, source, source_id, name, data, created_at')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error || !data) return []
    return (data as unknown as UserRecipeRow[]).map((row) => {
      const d = row.data ?? ({} as Recipe)
      return {
        ...d,
        id: row.id,
        source: row.source,
        sourceId: row.source_id ?? d.sourceId,
        name: row.name ?? d.name,
      } as Recipe
    })
  } catch {
    return []
  }
}

export async function findSavedRecipe(id: string): Promise<Recipe | null> {
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('user_recipes')
      .select('id, source, source_id, name, data')
      .eq('id', id)
      .maybeSingle()
    if (error || !data) return null
    const row = data as unknown as UserRecipeRow
    return {
      ...(row.data ?? ({} as Recipe)),
      id: row.id,
      source: row.source,
      sourceId: row.source_id ?? row.data?.sourceId,
      name: row.name ?? row.data?.name,
    } as Recipe
  } catch {
    return null
  }
}

export async function saveRecipe(
  recipe: Omit<Recipe, 'id'> & { id?: string },
): Promise<{ ok: boolean; recipe?: Recipe; error?: string }> {
  try {
    const sb = createServiceClient()
    const insert = {
      source: recipe.source,
      source_id: recipe.sourceId ?? null,
      name: recipe.name,
      data: { ...recipe } as unknown,
    }
    const { data, error } = await sb
      .from('user_recipes')
      .insert(insert)
      .select('id, source, source_id, name, data')
      .single()
    if (error || !data) return { ok: false, error: error?.message ?? 'no row' }
    const row = data as unknown as UserRecipeRow
    return {
      ok: true,
      recipe: {
        ...(row.data ?? ({} as Recipe)),
        id: row.id,
        source: row.source,
        sourceId: row.source_id ?? row.data?.sourceId,
        name: row.name,
      } as Recipe,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' }
  }
}

export async function deleteSavedRecipe(id: string): Promise<boolean> {
  try {
    const sb = createServiceClient()
    const { error } = await sb.from('user_recipes').delete().eq('id', id)
    return !error
  } catch {
    return false
  }
}

export async function recipeStatsForContext(): Promise<{
  count: number
  recent: { name: string; createdAt: string }[]
}> {
  try {
    const sb = createServiceClient()
    const { count } = await sb
      .from('user_recipes')
      .select('id', { count: 'exact', head: true })
    const { data } = await sb
      .from('user_recipes')
      .select('name, created_at')
      .order('created_at', { ascending: false })
      .limit(5)
    return {
      count: count ?? 0,
      recent: (data ?? []).map(
        (r: { name: string; created_at: string }) => ({
          name: r.name,
          createdAt: r.created_at,
        }),
      ),
    }
  } catch {
    return { count: 0, recent: [] }
  }
}
