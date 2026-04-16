/**
 * Open Food Facts API Client
 *
 * Free, open-source food database with 4M+ products.
 * Provides: barcode lookup, NOVA processing scores, additives,
 * allergen info, ingredient lists.
 *
 * API: https://world.openfoodfacts.org/api/v2/
 * No API key needed. CC-BY-SA license.
 */

export interface OpenFoodProduct {
  barcode: string
  name: string
  brands: string | null
  imageUrl: string | null
  // Nutrients per 100g
  calories: number | null
  protein: number | null
  fat: number | null
  carbs: number | null
  fiber: number | null
  sugar: number | null
  sodium: number | null
  // Classification
  novaGroup: number | null       // 1=unprocessed, 2=processed ingredients, 3=processed, 4=ultra-processed
  nutriscoreGrade: string | null // a, b, c, d, e
  allergens: string[]
  ingredients: string | null
}

const BASE_URL = 'https://world.openfoodfacts.org/api/v2'

/**
 * Look up a product by barcode (EAN/UPC).
 */
export async function lookupBarcode(barcode: string): Promise<OpenFoodProduct | null> {
  const res = await fetch(`${BASE_URL}/product/${barcode}.json`, {
    headers: { 'User-Agent': 'LanaeHealth/1.0 (health-tracking-app)' },
  })

  if (!res.ok) return null

  const data = await res.json()
  if (data.status !== 1 || !data.product) return null

  const p = data.product

  return {
    barcode,
    name: p.product_name ?? p.product_name_en ?? 'Unknown Product',
    brands: p.brands ?? null,
    imageUrl: p.image_front_small_url ?? p.image_url ?? null,
    calories: p.nutriments?.['energy-kcal_100g'] ?? null,
    protein: p.nutriments?.proteins_100g ?? null,
    fat: p.nutriments?.fat_100g ?? null,
    carbs: p.nutriments?.carbohydrates_100g ?? null,
    fiber: p.nutriments?.fiber_100g ?? null,
    sugar: p.nutriments?.sugars_100g ?? null,
    sodium: p.nutriments?.sodium_100g ? p.nutriments.sodium_100g * 1000 : null, // Convert g to mg
    novaGroup: p.nova_group ?? null,
    nutriscoreGrade: p.nutriscore_grade ?? null,
    allergens: p.allergens_tags?.map((a: string) => a.replace('en:', '')) ?? [],
    ingredients: p.ingredients_text ?? null,
  }
}

/**
 * Search for products by name.
 */
export async function searchProducts(query: string, limit: number = 10): Promise<OpenFoodProduct[]> {
  const params = new URLSearchParams({
    search_terms: query,
    page_size: String(limit),
    json: '1',
    fields: 'code,product_name,brands,image_front_small_url,nutriments,nova_group,nutriscore_grade,allergens_tags',
  })

  const res = await fetch(`${BASE_URL}/search?${params}`, {
    headers: { 'User-Agent': 'LanaeHealth/1.0 (health-tracking-app)' },
  })

  if (!res.ok) return []

  const data = await res.json()
  return (data.products ?? []).map((p: Record<string, unknown>) => ({
    barcode: p.code as string ?? '',
    name: (p.product_name as string) ?? 'Unknown',
    brands: (p.brands as string) ?? null,
    imageUrl: (p.image_front_small_url as string) ?? null,
    calories: (p.nutriments as Record<string, number>)?.['energy-kcal_100g'] ?? null,
    protein: (p.nutriments as Record<string, number>)?.proteins_100g ?? null,
    fat: (p.nutriments as Record<string, number>)?.fat_100g ?? null,
    carbs: (p.nutriments as Record<string, number>)?.carbohydrates_100g ?? null,
    fiber: (p.nutriments as Record<string, number>)?.fiber_100g ?? null,
    sugar: (p.nutriments as Record<string, number>)?.sugars_100g ?? null,
    sodium: null,
    novaGroup: (p.nova_group as number) ?? null,
    nutriscoreGrade: (p.nutriscore_grade as string) ?? null,
    allergens: ((p.allergens_tags as string[]) ?? []).map(a => a.replace('en:', '')),
    ingredients: null,
  }))
}

/**
 * Get NOVA classification description.
 */
export function getNovaDescription(group: number | null): string {
  switch (group) {
    case 1: return 'Unprocessed or minimally processed'
    case 2: return 'Processed culinary ingredients'
    case 3: return 'Processed food'
    case 4: return 'Ultra-processed food'
    default: return 'Unknown processing level'
  }
}

/**
 * Get NOVA color for display.
 */
export function getNovaColor(group: number | null): string {
  switch (group) {
    case 1: return 'var(--accent-sage)'
    case 2: return '#6B9080'
    case 3: return '#F57F17'
    case 4: return '#C62828'
    default: return 'var(--text-muted)'
  }
}
