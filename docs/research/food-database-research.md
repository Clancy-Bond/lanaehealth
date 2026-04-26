# Food Database Research - LanaeHealth v2 Calories

Conducted via Firecrawl, 2026-04-24. Goal: pick a database strategy
that puts photos on every food row to get MFN-grade visual fidelity.

## TL;DR

**Use Open Food Facts (already integrated) as the photo provider and
secondary search source. USDA FoodData Central stays as the primary
nutrient source for non-branded foods. Skip MyNetDiary scraping
(legal exposure + functionally unnecessary). Defer Edamam and
FatSecret unless OFF + USDA coverage gaps warrant the cost.**

---

## 1. Open Food Facts (off)

- Endpoint: `https://world.openfoodfacts.org/api/v2/`
- Database size: 4M+ products (mostly branded packaged food, global)
- Photos: yes, every product (`image_front_small_url`,
  `image_front_url`, `image_url`)
- License: Open Database License (database) + CC-BY-SA 3.0 (photos)
- API key: none required. Identify yourself via `User-Agent`
- Rate limit: 100 req / min for read, with bulk dump preferred above
  that
- Cost: free
- Status: confirmed live at scrape time. Already integrated at
  `src/lib/api/open-food-facts.ts` with `lookupBarcode` and
  `searchProducts`.

**Photo coverage:** branded packaged products are ~95%+ photographed
(community-contributed). Generic foods (e.g. "raw apple") have very
sparse coverage; OFF is brand-centric.

## 2. USDA FoodData Central (usda)

- Endpoint: `https://api.nal.usda.gov/fdc/v1/`
- Database size: 380K+ items (Foundation, SR Legacy, Survey FNDDS,
  Branded)
- Photos: **none.** Confirmed by USDA FAQ + Stack Exchange thread.
  USDA's mandate is nutrient data, not food imagery. Branded foods
  in USDA contain a `gtinUpc` field that can cross-reference Open
  Food Facts to obtain a photo.
- License: public domain (US government data)
- API key: required (free, demo key works for testing)
- Cost: free
- Rate limit: 1000 req / hour with key

## 3. MyNetDiary (mfn)

- Database size: ~1.4M+ items (claimed)
- Photos: yes (proprietary)
- API: commercial only. The licensing page
  (`mynetdiary.com/food-database.html`) advertises it as a "license
  for commercial use" product, with quarterly database updates and
  a sample spec ZIP at S3. Customers cited: Noom, Lifesum.
- License: explicitly forbids reselling the data; per their page,
  scraping is contractually disallowed.
- Cost: not posted. Per public reports, enterprise license starts
  in mid-five-figures USD/year.
- **Decision: skip.** Rationale below.

### Why not scrape MFN

1. **Legal exposure.** This is a productized health app. Their TOS
   explicitly prohibits scraping. The hiQ Labs v. LinkedIn case set
   the bar for "public data is fair game" but only for genuinely
   public data; MFN's catalog sits behind their app login for full
   nutrient detail. A small data-loss judgment against a one-patient
   medical-records app would still be ruinous.
2. **Functional redundancy.** MFN's catalog is itself derived from
   USDA + Open Food Facts + community curation + brand submissions.
   We already have direct access to the first two. The only delta
   is curation. We cover that with our own `custom-foods` table when
   needed.
3. **Maintenance cost.** Scraping frameworks rot when the source
   site updates HTML. We do not want a load-bearing scrape job for
   patient food logging.
4. **Attribution + photo licensing.** MFN photos are theirs;
   redistributing would be infringement. OFF photos are CC-BY-SA
   and freely redistributable.

If a single specific food is missing from USDA + OFF and the user
needs it for an upcoming doctor visit, the right path is to add it
to the existing `custom_foods` table via the in-app admin UI, not
scrape.

## 4. Edamam Food Database

- Photos: yes (per Edamam's own copy: "food image" is one of the
  cacheable fields)
- Database size: ~900K foods + 2.6M recipes
- License: paid SaaS. Lowest tier $14/mo (100K calls); business
  tier $69/mo (750K calls); enterprise $299/mo (5M calls).
- Caching restriction: only allowed to cache calories + macros +
  food id + label + image. Cannot cache full nutrient profile.
  Active subscription required while cache is in use.
- TOS prohibits scraping their API responses for bulk reuse.
- **Decision: defer.** Cost-effective only if OFF + USDA coverage
  proves insufficient for Lanae's specific food log.

## 5. FatSecret Platform API

- Photos: yes (in Premier tier; not in Basic)
- Database size: ~2M foods global (US dataset standalone)
- License: Basic tier free (no images, no caching). Premier Free
  tier requires startup/nonprofit application and includes images +
  caching. Premier Enterprise is custom-quoted.
- Premier Free is application-based and may be denied for
  health-data products.
- **Decision: defer.** Same reasoning as Edamam plus the application
  uncertainty.

## Recommended strategy (ship now)

1. Photos: query Open Food Facts for every food we render. Match
   by GTIN/UPC when USDA gives one (branded foods); fall back to
   name search for unbranded. Cache 30 days in `api_cache`.
2. Search: keep USDA as the primary search source for accurate
   nutrient data. Add OFF as a parallel source so the brand-centric
   long tail (e.g. "Trader Joe's frozen mandarin chicken") appears.
   De-dupe by name+brand. Prefer the row that has both a photo and
   nutrient completeness.
3. Custom foods: keep the existing `custom_foods` table for items
   not in either source.
4. Defer paid databases until a real coverage gap forces the issue.

## Estimated photo hit rate

Based on database composition:

- Branded foods (e.g. "Cheerios", "Greek yogurt 2%"): ~85% expected
  hit via OFF GTIN match
- Survey/FNDDS foods (e.g. "Apple, raw, with skin"): ~30% via name
  search since OFF is brand-centric
- Foundation/SR Legacy foods (e.g. "Apple, raw"): ~25% via name
  search

Weighted blend across a typical food log (skewed toward branded):
~60-70% hit rate is the planning number.
