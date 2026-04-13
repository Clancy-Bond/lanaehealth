// Endometriosis food trigger detection logic
// These are common inflammatory triggers for endo patients

export const TRIGGER_CATEGORIES: Record<string, string[]> = {
  'Gluten': [
    'bread', 'wheat', 'pasta', 'flour', 'cereal', 'crackers', 'cookies', 'cake',
    'muffin', 'bagel', 'pizza', 'tortilla', 'couscous', 'barley', 'rye', 'noodle',
    'croissant', 'pancake', 'waffle', 'pretzel', 'biscuit',
  ],
  'Dairy': [
    'milk', 'cheese', 'yogurt', 'cream', 'butter', 'ice cream', 'whey',
    'casein', 'ghee', 'latte', 'cappuccino', 'mozzarella', 'cheddar',
    'parmesan', 'ricotta', 'brie', 'sour cream', 'cottage cheese',
  ],
  'Soy': [
    'soy', 'tofu', 'edamame', 'tempeh', 'miso', 'soy sauce', 'soy milk',
    'soybean',
  ],
  'Red Meat': [
    'beef', 'steak', 'burger', 'hamburger', 'pork', 'bacon', 'sausage',
    'lamb', 'veal', 'ribs', 'brisket', 'meatball', 'meatloaf', 'hot dog',
    'pepperoni', 'salami', 'ham', 'chorizo',
  ],
  'Alcohol': [
    'wine', 'beer', 'cocktail', 'vodka', 'whiskey', 'rum', 'tequila',
    'gin', 'champagne', 'margarita', 'sangria', 'sake', 'hard seltzer',
    'mimosa', 'alcohol',
  ],
  'Caffeine': [
    'coffee', 'espresso', 'latte', 'cappuccino', 'energy drink', 'black tea',
    'green tea', 'matcha', 'cold brew', 'americano',
  ],
  'Sugar': [
    'candy', 'chocolate', 'soda', 'pop', 'coke', 'sprite', 'fanta',
    'gummy', 'dessert', 'brownie', 'donut', 'doughnut', 'pastry',
    'syrup', 'honey', 'caramel', 'fudge', 'frosting',
  ],
  'Processed Foods': [
    'chips', 'fries', 'fried', 'fast food', 'microwave', 'frozen dinner',
    'tv dinner', 'ramen', 'instant noodle', 'nugget', 'corn dog',
    'tater tot', 'onion ring',
  ],
  'High FODMAP': [
    'garlic', 'onion', 'apple', 'pear', 'watermelon', 'mango',
    'asparagus', 'artichoke', 'cauliflower', 'mushroom', 'avocado',
    'honey', 'agave', 'chicory', 'lentils', 'chickpea', 'hummus',
  ],
  'Trans Fats': [
    'margarine', 'shortening', 'hydrogenated', 'fried', 'deep fried',
  ],
}

export interface DetectedTrigger {
  category: string
  matchedWord: string
}

/**
 * Detect potential inflammatory triggers in food text
 */
export function detectTriggers(foodText: string): DetectedTrigger[] {
  const lower = foodText.toLowerCase()
  const triggers: DetectedTrigger[] = []
  const seen = new Set<string>()

  for (const [category, words] of Object.entries(TRIGGER_CATEGORIES)) {
    for (const word of words) {
      if (lower.includes(word) && !seen.has(category)) {
        triggers.push({ category, matchedWord: word })
        seen.add(category)
        break // One match per category is enough
      }
    }
  }

  return triggers
}

/**
 * Get all trigger category names
 */
export function getTriggerCategories(): string[] {
  return Object.keys(TRIGGER_CATEGORIES)
}
