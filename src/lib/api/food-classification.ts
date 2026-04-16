/**
 * Food Classification System
 *
 * Classifies foods by:
 * - FODMAP level (low/moderate/high per category)
 * - Histamine level (low/moderate/high)
 * - Common allergens (gluten, dairy, soy, nuts, eggs, shellfish)
 * - Anti-inflammatory score (-10 to +10)
 * - Iron absorption context (enhancers vs inhibitors)
 *
 * Used by the nutrition tracker to auto-tag foods for chronic illness patients.
 */

export type FodmapLevel = 'low' | 'moderate' | 'high' | 'unknown'
export type HistamineLevel = 'low' | 'moderate' | 'high' | 'unknown'
export type AllergenType = 'gluten' | 'dairy' | 'soy' | 'nuts' | 'eggs' | 'shellfish' | 'fish' | 'corn'

export interface FoodClassification {
  fodmap: FodmapLevel
  fodmapCategories: string[]     // Which FODMAP groups (fructans, lactose, fructose, polyols, galactans)
  histamine: HistamineLevel
  allergens: AllergenType[]
  antiInflammatoryScore: number  // -10 (very inflammatory) to +10 (very anti-inflammatory)
  ironAbsorption: 'enhancer' | 'inhibitor' | 'neutral'
  tags: string[]                 // Human-readable tags like "High histamine", "Iron inhibitor"
}

// ── FODMAP Classification ──────────────────────────────────────────

const HIGH_FODMAP_KEYWORDS = [
  'garlic', 'onion', 'wheat', 'rye', 'barley', 'apple', 'pear', 'watermelon',
  'mango', 'honey', 'high fructose', 'agave', 'cauliflower', 'mushroom',
  'artichoke', 'asparagus', 'chickpea', 'lentil', 'kidney bean', 'black bean',
  'baked bean', 'milk', 'yogurt', 'ice cream', 'soft cheese', 'cottage cheese',
  'peach', 'plum', 'prune', 'cherry', 'nectarine', 'apricot', 'avocado',
  'blackberry', 'boysenberry',
]

const LOW_FODMAP_KEYWORDS = [
  'rice', 'potato', 'carrot', 'cucumber', 'tomato', 'lettuce', 'spinach',
  'zucchini', 'bell pepper', 'green bean', 'eggplant', 'banana', 'blueberry',
  'strawberry', 'grape', 'orange', 'pineapple', 'kiwi', 'lemon', 'lime',
  'chicken', 'turkey', 'beef', 'pork', 'fish', 'salmon', 'tuna', 'shrimp',
  'egg', 'tofu', 'tempeh', 'oat', 'quinoa', 'corn', 'maple syrup',
  'hard cheese', 'cheddar', 'parmesan', 'brie', 'feta', 'lactose-free',
]

// ── Histamine Classification ───────────────────────────────────────

const HIGH_HISTAMINE_KEYWORDS = [
  'aged cheese', 'parmesan', 'cheddar', 'gouda', 'blue cheese',
  'fermented', 'sauerkraut', 'kimchi', 'kombucha', 'vinegar', 'soy sauce',
  'wine', 'beer', 'champagne', 'cider',
  'cured meat', 'salami', 'pepperoni', 'ham', 'bacon', 'hot dog', 'sausage',
  'smoked fish', 'smoked salmon', 'anchovy', 'sardine', 'mackerel', 'tuna',
  'tomato', 'spinach', 'eggplant', 'avocado',
  'strawberry', 'citrus', 'pineapple', 'banana', 'papaya',
  'chocolate', 'cocoa', 'cinnamon',
  'leftover', 'reheated',
]

const LOW_HISTAMINE_KEYWORDS = [
  'fresh meat', 'fresh chicken', 'fresh fish',
  'rice', 'potato', 'sweet potato', 'carrot', 'broccoli', 'cauliflower',
  'apple', 'pear', 'blueberry', 'melon', 'mango', 'grape',
  'fresh milk', 'cream cheese', 'butter',
  'bread', 'pasta', 'oat', 'quinoa',
  'olive oil', 'coconut oil',
  'herbal tea', 'water',
]

// ── Allergen Detection ─────────────────────────────────────────────

const ALLERGEN_KEYWORDS: Record<AllergenType, string[]> = {
  gluten: ['wheat', 'barley', 'rye', 'bread', 'pasta', 'flour', 'cereal', 'cracker', 'pizza', 'cake', 'cookie', 'muffin', 'croissant', 'bagel'],
  dairy: ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'ice cream', 'whey', 'casein', 'latte', 'cappuccino'],
  soy: ['soy', 'tofu', 'tempeh', 'edamame', 'miso', 'soy sauce'],
  nuts: ['almond', 'walnut', 'cashew', 'pecan', 'pistachio', 'macadamia', 'hazelnut', 'peanut', 'nut butter'],
  eggs: ['egg', 'omelet', 'frittata', 'quiche', 'meringue', 'mayonnaise'],
  shellfish: ['shrimp', 'crab', 'lobster', 'oyster', 'mussel', 'clam', 'scallop'],
  fish: ['salmon', 'tuna', 'cod', 'tilapia', 'halibut', 'sardine', 'anchovy', 'trout', 'bass', 'swordfish'],
  corn: ['corn', 'popcorn', 'cornstarch', 'cornmeal', 'tortilla chip', 'corn syrup'],
}

// ── Anti-Inflammatory Scoring ──────────────────────────────────────

const ANTI_INFLAMMATORY: Record<string, number> = {
  // Very anti-inflammatory (+7 to +10)
  'salmon': 9, 'sardine': 9, 'mackerel': 8, 'turmeric': 10, 'ginger': 8,
  'blueberry': 8, 'strawberry': 7, 'cherry': 8, 'spinach': 7, 'kale': 7,
  'broccoli': 7, 'olive oil': 9, 'walnut': 7, 'flaxseed': 8, 'chia': 8,
  'green tea': 7, 'dark chocolate': 6, 'avocado': 6, 'sweet potato': 6,
  'beet': 7, 'garlic': 7, 'bone broth': 6,

  // Mildly anti-inflammatory (+3 to +6)
  'chicken': 3, 'turkey': 3, 'egg': 3, 'brown rice': 3, 'quinoa': 4,
  'lentil': 4, 'black bean': 4, 'almond': 5, 'carrot': 4, 'tomato': 4,
  'bell pepper': 4, 'cucumber': 3, 'apple': 4, 'orange': 4, 'banana': 3,

  // Inflammatory (-3 to -10)
  'sugar': -7, 'candy': -8, 'soda': -8, 'french fry': -6, 'fried': -5,
  'hot dog': -7, 'bacon': -5, 'salami': -6, 'white bread': -3,
  'margarine': -6, 'processed': -5, 'fast food': -7, 'donut': -7,
  'chip': -4, 'cookie': -4, 'cake': -5, 'ice cream': -3,
  'beer': -4, 'alcohol': -4, 'wine': -2,
}

// ── Iron Absorption ────────────────────────────────────────────────

const IRON_ENHANCERS = [
  'vitamin c', 'orange', 'lemon', 'lime', 'grapefruit', 'strawberry',
  'bell pepper', 'broccoli', 'tomato', 'kiwi', 'papaya', 'mango',
]

const IRON_INHIBITORS = [
  'calcium', 'milk', 'cheese', 'yogurt',
  'coffee', 'tea', 'cocoa', 'chocolate',
  'wine', 'beer',
  'whole grain', 'bran', 'oat',
  'spinach', // oxalates
]

// ── Main Classification Function ───────────────────────────────────

export function classifyFood(foodName: string): FoodClassification {
  const lower = foodName.toLowerCase()
  const tags: string[] = []

  // FODMAP
  let fodmap: FodmapLevel = 'unknown'
  const fodmapCategories: string[] = []
  if (HIGH_FODMAP_KEYWORDS.some(kw => lower.includes(kw))) {
    fodmap = 'high'
    tags.push('High FODMAP')
  } else if (LOW_FODMAP_KEYWORDS.some(kw => lower.includes(kw))) {
    fodmap = 'low'
  }

  // Histamine
  let histamine: HistamineLevel = 'unknown'
  if (HIGH_HISTAMINE_KEYWORDS.some(kw => lower.includes(kw))) {
    histamine = 'high'
    tags.push('High histamine')
  } else if (LOW_HISTAMINE_KEYWORDS.some(kw => lower.includes(kw))) {
    histamine = 'low'
  }

  // Allergens
  const allergens: AllergenType[] = []
  for (const [allergen, keywords] of Object.entries(ALLERGEN_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      allergens.push(allergen as AllergenType)
    }
  }
  if (allergens.length > 0) {
    tags.push(`Contains: ${allergens.join(', ')}`)
  }

  // Anti-inflammatory score
  let score = 0
  let matchCount = 0
  for (const [food, value] of Object.entries(ANTI_INFLAMMATORY)) {
    if (lower.includes(food)) {
      score += value
      matchCount++
    }
  }
  const antiInflammatoryScore = matchCount > 0 ? Math.round(score / matchCount) : 0

  if (antiInflammatoryScore >= 5) tags.push('Anti-inflammatory')
  else if (antiInflammatoryScore <= -3) tags.push('Inflammatory')

  // Iron absorption
  let ironAbsorption: 'enhancer' | 'inhibitor' | 'neutral' = 'neutral'
  if (IRON_ENHANCERS.some(kw => lower.includes(kw))) {
    ironAbsorption = 'enhancer'
    tags.push('Iron absorption enhancer')
  } else if (IRON_INHIBITORS.some(kw => lower.includes(kw))) {
    ironAbsorption = 'inhibitor'
    tags.push('Iron absorption inhibitor')
  }

  return {
    fodmap,
    fodmapCategories,
    histamine,
    allergens,
    antiInflammatoryScore,
    ironAbsorption,
    tags,
  }
}

/**
 * Get a color for the anti-inflammatory score.
 */
export function getInflammationColor(score: number): string {
  if (score >= 5) return 'var(--accent-sage)'
  if (score >= 0) return '#6B9080'
  if (score >= -3) return '#F57F17'
  return '#C62828'
}
