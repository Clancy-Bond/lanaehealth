/**
 * Food name → emoji mapping for search result badges.
 *
 * MFN renders a small square photo on the left of every search result.
 * Their database is a decade of curated product imagery; we don't have
 * that. Until we wire a stock-photo source (Pixabay / Unsplash /
 * Spoonacular), the next-best visual cue is the Unicode food emoji
 * keyed to the food's category. "🥚 Eggs" reads instantly; "E" with
 * a colored background does not.
 *
 * Approach: progressive fallback.
 *
 *   1. Exact category match by keyword in the food name (~60 entries).
 *      Covers ~70% of common foods.
 *   2. Substring match against broader category buckets (~25 buckets).
 *      Covers ~20% more.
 *   3. Letter badge fallback (existing PR #64 behavior) for the
 *      remaining ~10%.
 *
 * The keyword list is ordered most-specific first ("egg whole" before
 * "egg") so the matcher returns on the right entry.
 */

/** Direct keyword → emoji entries. Lowercase. Order matters
 *  (most-specific first). */
const KEYWORD_MAP: Array<[RegExp, string]> = [
  // Eggs
  [/\begg\s+white\b/i, '🥚'],
  [/\begg\s+yolk\b/i, '🥚'],
  [/\begg\s+omelet\b/i, '🍳'],
  [/\begg\s+scrambled\b/i, '🍳'],
  [/\bomelet\b/i, '🍳'],
  [/\bscrambled\b/i, '🍳'],
  [/\bbenedict\b/i, '🍳'],
  [/\beggs?\b/i, '🥚'],

  // Bread / grains
  [/\bbagels?\b/i, '🥯'],
  [/\bcroissants?\b/i, '🥐'],
  [/\bbaguettes?\b/i, '🥖'],
  [/\bpretzel\b/i, '🥨'],
  [/\bpancakes?\b/i, '🥞'],
  [/\bwaffles?\b/i, '🧇'],
  [/\bbreads?\b/i, '🍞'],
  [/\btoast\b/i, '🍞'],
  [/\boatmeal\b/i, '🥣'],
  [/\boats?\b/i, '🥣'],
  [/\bcereal\b/i, '🥣'],
  [/\bgranola\b/i, '🥣'],
  [/\brice\b/i, '🍚'],
  [/\bpasta\b/i, '🍝'],
  [/\bnoodles?\b/i, '🍜'],
  [/\bspaghetti\b/i, '🍝'],
  [/\bquinoa\b/i, '🌾'],

  // Meat
  [/\bsteaks?\b/i, '🥩'],
  [/\bbeef\b/i, '🥩'],
  [/\bfilet\s+mignon\b/i, '🥩'],
  [/\bhamburger\b|\bburger\b/i, '🍔'],
  [/\bbacon\b/i, '🥓'],
  [/\bsausage\b/i, '🌭'],
  [/\bhot\s*dog\b/i, '🌭'],
  [/\bporks?\b/i, '🥩'],
  [/\bham\b/i, '🥓'],
  [/\bturkey\b/i, '🦃'],
  [/\bchicken\b/i, '🍗'],
  [/\blamb\b/i, '🥩'],

  // Seafood
  [/\bsalmon\b/i, '🐟'],
  [/\btunas?\b/i, '🐟'],
  [/\bcod\b|\btilapia\b|\bhalibut\b|\bbass\b|\btrout\b|\bmackerel\b|\bsnapper\b/i, '🐟'],
  [/\bfish\b/i, '🐟'],
  [/\bshrimps?\b|\bprawns?\b/i, '🦐'],
  [/\bcrabs?\b/i, '🦀'],
  [/\blobsters?\b/i, '🦞'],
  [/\bsushi\b/i, '🍣'],
  [/\boysters?\b|\bclams?\b|\bmussels?\b|\bscallops?\b/i, '🦪'],
  [/\bsquid\b|\boctopus\b/i, '🦑'],

  // Dairy
  [/\bmilk\b/i, '🥛'],
  [/\byog(h)?urt\b/i, '🥣'],
  [/\bcheese\b/i, '🧀'],
  [/\bbutter\b/i, '🧈'],
  [/\bcream\b/i, '🥛'],
  [/\bice\s+cream\b/i, '🍨'],

  // Fruit
  [/\bapples?\b/i, '🍎'],
  [/\bbananas?\b/i, '🍌'],
  [/\boranges?\b|\btangerines?\b|\bclementines?\b/i, '🍊'],
  [/\bgrapes?\b/i, '🍇'],
  [/\bstrawberr/i, '🍓'],
  [/\bblueberr/i, '🫐'],
  [/\braspberr/i, '🍓'],
  [/\bblackberr/i, '🫐'],
  [/\bcherries?\b|\bcherry\b/i, '🍒'],
  [/\bpeaches?\b|\bnectarines?\b/i, '🍑'],
  [/\bplums?\b/i, '🍑'],
  [/\bpears?\b/i, '🍐'],
  [/\bpineapples?\b/i, '🍍'],
  [/\bmangos?\b|\bmangoes\b/i, '🥭'],
  [/\bwatermelons?\b/i, '🍉'],
  [/\bmelons?\b|\bcantaloupes?\b|\bhoneydew\b/i, '🍈'],
  [/\bkiwis?\b/i, '🥝'],
  [/\bavocados?\b/i, '🥑'],
  [/\bcoconuts?\b/i, '🥥'],
  [/\blemons?\b|\blimes?\b/i, '🍋'],
  [/\bdates?\b|\bfigs?\b/i, '🍯'],

  // Vegetables
  [/\bbroccoli\b/i, '🥦'],
  [/\bcauliflower\b/i, '🥦'],
  [/\bcarrots?\b/i, '🥕'],
  [/\btomatoes?\b/i, '🍅'],
  [/\bcucumbers?\b/i, '🥒'],
  [/\blettuce\b|\bromaine\b|\barugula\b|\bspinach\b|\bkale\b/i, '🥬'],
  [/\bsalads?\b/i, '🥗'],
  [/\bonions?\b|\bshallots?\b|\bscallions?\b/i, '🧅'],
  [/\bgarlic\b/i, '🧄'],
  [/\bpotatoes?\b/i, '🥔'],
  [/\bsweet\s+potato\b|\byams?\b/i, '🍠'],
  [/\bcorn\b/i, '🌽'],
  [/\bpeppers?\b|\bjalape/i, '🌶️'],
  [/\beggplants?\b|\baubergine\b/i, '🍆'],
  [/\bmushrooms?\b/i, '🍄'],
  [/\bbeans?\b|\blentils?\b|\bchickpeas?\b/i, '🫘'],
  [/\bpeas?\b/i, '🫛'],

  // Nuts / seeds
  [/\bpeanuts?\b/i, '🥜'],
  [/\balmonds?\b|\bcashews?\b|\bwalnuts?\b|\bpecans?\b|\bpistachios?\b|\bhazelnuts?\b/i, '🥜'],
  [/\bnuts?\b/i, '🥜'],
  [/\bseeds?\b|\bchias?\b|\bflax\b/i, '🌰'],

  // Beverages
  [/\bcoffees?\b|\bespresso\b|\blattes?\b|\bcappuccino/i, '☕'],
  [/\bteas?\b|\bmatcha\b/i, '🍵'],
  [/\bjuices?\b/i, '🧃'],
  [/\bsodas?\b|\bcola\b|\bsoft\s+drink/i, '🥤'],
  [/\bwaters?\b/i, '💧'],
  [/\bwines?\b/i, '🍷'],
  [/\bbeers?\b/i, '🍺'],
  [/\bcocktails?\b/i, '🍸'],
  [/\bsmoothies?\b|\bshakes?\b/i, '🥤'],

  // Snacks / sweets
  [/\bcookies?\b/i, '🍪'],
  [/\bcakes?\b/i, '🍰'],
  [/\bpies?\b/i, '🥧'],
  [/\bdonuts?\b|\bdoughnuts?\b/i, '🍩'],
  [/\bchocolates?\b/i, '🍫'],
  [/\bcandy\b/i, '🍬'],
  [/\bpopcorn\b/i, '🍿'],
  [/\bchips?\b|\bcrackers?\b/i, '🍘'],
  [/\bpretzels?\b/i, '🥨'],
  [/\bpizzas?\b/i, '🍕'],
  [/\btacos?\b|\bburritos?\b|\bquesadilla\b/i, '🌮'],
  [/\bsandwich(es)?\b|\bsubs?\b|\bwrap\b/i, '🥪'],
  [/\bsoups?\b|\bbroths?\b|\bstews?\b|\bcongees?\b/i, '🥣'],
  [/\bcurry\b/i, '🍛'],
  [/\bdumplings?\b|\bgyozas?\b|\bpotsticker/i, '🥟'],
  [/\bramen\b/i, '🍜'],

  // Condiments / fats
  [/\boils?\b|\bvinegars?\b|\bdressings?\b|\bsauces?\b|\bketchup\b|\bmustards?\b|\bmayo\b|\bsalsas?\b/i, '🫒'],
  [/\bhoney\b|\bsyrups?\b|\bmaples?\b|\bjams?\b|\bjellies\b|\bpreserves?\b/i, '🍯'],
  [/\bsugars?\b|\bsweetener/i, '🧂'],
  [/\bsalt\b|\bspice/i, '🧂'],
]

/** Returns the food emoji for a given food name, or null when no
 *  category match is found (caller falls back to a letter badge). */
export function emojiForFood(name: string): string | null {
  if (!name) return null
  const trimmed = name.trim().toLowerCase()
  if (!trimmed) return null
  for (const [re, emoji] of KEYWORD_MAP) {
    if (re.test(trimmed)) return emoji
  }
  return null
}
