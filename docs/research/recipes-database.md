# Recipes Database Research

User direction (2026-04-24): "I think MyNetDiary has an entire database. If
you can get ahold of a database, massive. Like, millions of recipes and
foods, that have been put in with all the weights that you possibly can use."

PR #67 already integrated Open Food Facts (4M products) for foods. OFF is
weak on recipes. This doc captures the recipe-side options, scored against
LanaeHealth needs (real patient, doctor-visit data, ZERO data loss, free or
near-free at v1 scale, legal to ship).

## Sources researched

### 1. Edamam Recipe Search API (recommended primary)

- 2.3M+ recipes indexed across the open recipe web (food blogs, AllRecipes,
  Epicurious, BBC Good Food, Martha Stewart, etc.)
- Returns full ingredient breakdown, per-serving nutrition (incl. fiber,
  sugar, sodium, micronutrients), servings, total time, cuisine type,
  diet labels (vegetarian, gluten-free, paleo), health labels
  (low-FODMAP, dairy-free), and a recipe image.
- Free tier: 5 req/min, 10K/month. Enough for personal use.
- Production tier: $20/month for 100K req/month, $50/month for 500K.
- Auth: app_id + app_key, sent as query string.
- TOS: explicit grant to use data in apps; attribution link required.
- Endpoint: `https://api.edamam.com/api/recipes/v2?type=public&q=<query>&app_id=<id>&app_key=<key>`

### 2. Spoonacular

- 5K+ curated recipes, much smaller catalog than Edamam.
- Free tier: 150 req/day, then $30/month minimum.
- Verdict: skip; Edamam is bigger and cheaper.

### 3. TheMealDB

- Free, ~300 recipes, hobbyist project.
- Verdict: too small to ship as primary search backend.

### 4. Open Food Facts recipes

- OFF has a `recipes` extension but coverage is in the thousands not millions.
- Verdict: keep OFF for products (PR #67), use Edamam for recipes.

### 5. MyFitnessPal recipe scraper

- TOS prohibits scraping. Legal risk. REJECTED.

### 6. USDA Recipes

- Discontinued and removed in 2014.
- Verdict: not applicable.

### 7. Recipe-scrapers libraries (recommended secondary)

- `recipe-scrapers` (Python) parses 400+ sites with ~95% success.
- Node ports: `recipe-scraper`, `@cooklang/cooklang-ts`. Smaller coverage
  but pure-JS so it runs in Next.js API routes without a Python bridge.
- For LanaeHealth we ship a built-in JSON-LD schema.org/Recipe parser that
  needs no external dep and covers most modern recipe sites.
- Legal: parsing user-pasted URLs is fair-use / personal use. We do NOT
  crawl, the user voluntarily imports a single page.

### 8. AllRecipes / Food Network direct scraping

- TOS prohibits crawling. Site-wide crawling: REJECTED.

## Recommendation

Stack:

1. **Edamam Recipe Search API** for searchable catalog (2.3M recipes,
   nutrition, photos).
2. **Built-in schema.org/Recipe parser** for user-pasted URL imports.
3. **Custom recipe builder** (already exists at
   `/v2/calories/recipes/new` via `health_profile.section='recipes'`)
   for hand-entered recipes.

Cost projection: free tier covers single-user usage easily. If we ever
move to multi-user we upgrade to the $20/month tier.

## Env vars to add

- `EDAMAM_APP_ID`
- `EDAMAM_APP_KEY`

UI must gracefully handle their absence (banner: "Recipe search needs
Edamam API key. Add EDAMAM_APP_ID + EDAMAM_APP_KEY to Vercel env.")

## Schema choice

A new `user_recipes` table with `data jsonb` keeps the existing
`health_profile.section='recipes'` (custom hand-built recipes) untouched
and ZERO data loss compliant. The new table holds Edamam-imported and
URL-imported recipes. Both list views read from both stores and merge.
