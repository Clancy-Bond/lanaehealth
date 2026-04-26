import { getCached, setCache } from './cache'
import { arr, num, prop, str } from './_safe-access'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface USDANutrients {
  fdcId: number
  description: string
  calories: number | null
  ironMg: number | null
  vitaminCMg: number | null
  calciumMg: number | null
  fiberG: number | null
  allNutrients: { name: string; amount: number; unit: string }[]
}

interface OpenFoodFactsInfo {
  productName: string
  brands: string
  novaGroup: number | null
  additives: string[]
  nutriments: Record<string, number>
  imageUrl: string
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search the USDA FoodData Central API for a food item and extract key nutrients:
 * iron (mg), vitamin C (mg), calcium (mg), fiber (g), and total calories.
 */
export async function getUSDANutrients(
  foodTerm: string
): Promise<USDANutrients | null> {
  const apiKey = process.env.USDA_API_KEY
  if (!apiKey) {
    console.warn('[nutrition] USDA_API_KEY not set, skipping USDA lookup')
    return null
  }

  const cacheKey = `usda:${foodTerm.toLowerCase()}`
  const cached = await getCached('usda', cacheKey)
  if (cached) return cached as USDANutrients

  try {
    // Step 1: search for the food item
    const searchRes = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}&query=${encodeURIComponent(foodTerm)}&pageSize=1`
    )
    if (!searchRes.ok) return null
    const searchData: unknown = await searchRes.json()
    const food = arr(searchData, 'foods')[0]
    if (!food) return null

    // Step 2: extract nutrients from the first result
    const nutrients: { name: string; amount: number; unit: string }[] = arr(
      food,
      'foodNutrients'
    ).map((n) => ({
      name: str(n, 'nutrientName'),
      amount: num(n, 'value'),
      unit: str(n, 'unitName'),
    }))

    const find = (keyword: string): number | null => {
      const n = nutrients.find((nu) =>
        nu.name.toLowerCase().includes(keyword.toLowerCase())
      )
      return n ? n.amount : null
    }

    const result: USDANutrients = {
      fdcId: num(food, 'fdcId'),
      description: str(food, 'description'),
      calories: find('Energy'),
      ironMg: find('Iron'),
      vitaminCMg: find('Vitamin C'),
      calciumMg: find('Calcium'),
      fiberG: find('Fiber'),
      allNutrients: nutrients,
    }

    await setCache('usda', cacheKey, result)
    return result
  } catch (err) {
    console.warn('[nutrition] USDA nutrient lookup failed:', err)
    return null
  }
}

/**
 * Search Open Food Facts for a product and extract NOVA group, additives,
 * and nutriment values.
 */
export async function getOpenFoodFactsInfo(
  searchTerm: string
): Promise<OpenFoodFactsInfo | null> {
  const cacheKey = `off:${searchTerm.toLowerCase()}`
  const cached = await getCached('openfoodfacts', cacheKey)
  if (cached) return cached as OpenFoodFactsInfo

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(searchTerm)}&search_simple=1&action=process&json=1&page_size=1`
    )
    if (!res.ok) return null
    const data: unknown = await res.json()
    const product = arr(data, 'products')[0]
    if (!product) return null

    const novaGroupRaw = prop(product, 'nova_group')
    const additives = arr(product, 'additives_tags').filter(
      (a): a is string => typeof a === 'string'
    )
    const nutrimentsRaw = prop(product, 'nutriments')
    const nutriments: Record<string, number> = {}
    if (nutrimentsRaw && typeof nutrimentsRaw === 'object') {
      for (const [k, v] of Object.entries(nutrimentsRaw)) {
        if (typeof v === 'number') nutriments[k] = v
      }
    }

    const result: OpenFoodFactsInfo = {
      productName: str(product, 'product_name'),
      brands: str(product, 'brands'),
      novaGroup: typeof novaGroupRaw === 'number' ? novaGroupRaw : null,
      additives,
      nutriments,
      imageUrl: str(product, 'image_url'),
    }

    await setCache('openfoodfacts', cacheKey, result)
    return result
  } catch (err) {
    console.warn('[nutrition] Open Food Facts lookup failed:', err)
    return null
  }
}
