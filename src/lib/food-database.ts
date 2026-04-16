/**
 * Food database integration with OpenFoodFacts API (free, no API key)
 * Provides food search with nutritional data for enhanced food tracking
 */

export interface FoodSearchResult {
  barcode: string | null
  name: string
  brand: string | null
  calories_per_100g: number | null
  image_url: string | null
  nutriscore_grade: string | null
  categories: string[]
}

const OFF_SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl'
const OFF_BARCODE_URL = 'https://world.openfoodfacts.org/api/v2/product'

/**
 * Search OpenFoodFacts by text query
 */
export async function searchFoods(query: string, limit = 10): Promise<FoodSearchResult[]> {
  if (!query.trim()) return []

  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: String(limit),
    fields: 'code,product_name,brands,nutriments,image_front_small_url,nutriscore_grade,categories_tags',
  })

  try {
    const res = await fetch(`${OFF_SEARCH_URL}?${params}`, {
      headers: { 'User-Agent': 'LanaeHealth/1.0 (health tracking app)' },
    })
    if (!res.ok) return []

    const data = await res.json()
    const products = data.products || []

    return products
      .filter((p: Record<string, unknown>) => p.product_name)
      .map((p: Record<string, unknown>) => ({
        barcode: (p.code as string) || null,
        name: p.product_name as string,
        brand: (p.brands as string) || null,
        calories_per_100g: (p.nutriments as Record<string, number>)?.['energy-kcal_100g'] ?? null,
        image_url: (p.image_front_small_url as string) || null,
        nutriscore_grade: (p.nutriscore_grade as string) || null,
        categories: Array.isArray(p.categories_tags) ? (p.categories_tags as string[]).slice(0, 3) : [],
      }))
  } catch {
    return []
  }
}

/**
 * Look up a food product by barcode
 */
export async function lookupBarcode(barcode: string): Promise<FoodSearchResult | null> {
  try {
    const res = await fetch(`${OFF_BARCODE_URL}/${barcode}.json`, {
      headers: { 'User-Agent': 'LanaeHealth/1.0 (health tracking app)' },
    })
    if (!res.ok) return null

    const data = await res.json()
    if (data.status !== 1 || !data.product) return null

    const p = data.product
    return {
      barcode: barcode,
      name: p.product_name || 'Unknown product',
      brand: p.brands || null,
      calories_per_100g: p.nutriments?.['energy-kcal_100g'] ?? null,
      image_url: p.image_front_small_url || null,
      nutriscore_grade: p.nutriscore_grade || null,
      categories: Array.isArray(p.categories_tags) ? p.categories_tags.slice(0, 3) : [],
    }
  } catch {
    return null
  }
}
