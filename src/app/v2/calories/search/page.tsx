import Link from 'next/link'
import { format } from 'date-fns'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { Banner, EmptyState } from '@/v2/components/primitives'
import { searchFoods, type FoodSearchResult } from '@/lib/api/usda-food'
import { searchProducts, type OpenFoodProduct } from '@/lib/api/open-food-facts'
import { lookupFoodPhotos } from '@/lib/api/food-photo'
import SearchTopTabs, { type SearchView } from './_components/SearchTopTabs'
import SearchInput from './_components/SearchInput'
import FoodSearchResultRow from './_components/FoodSearchResultRow'
import FavoritesSection from './_components/FavoritesSection'
import StaplesSection from './_components/StaplesSection'
import CustomFoodsSection from './_components/CustomFoodsSection'
import MyMealsSection from './_components/MyMealsSection'
import MyRecipesSection from './_components/MyRecipesSection'
import RecentMealsSection from './_components/RecentMealsSection'
import ScanStubSection from './_components/ScanStubSection'

export const dynamic = 'force-dynamic'

/*
 * LEARNING-MODE HOOK G7 - Search tab architecture.
 *
 * Option A (horizontal scrollable TabStrip, ship): 8 tabs wrapped in a
 *   scrollable strip with auto-scroll-into-view on active. Matches MFN
 *   density; works at 375pt.
 *
 * Option B (overflow menu): first 4 tabs visible, remaining under a
 *   "More" dropdown. Cleaner at 375pt but hides frequently-used tabs.
 *
 * Option C (two rows of SegmentedControl): less scroll, more chrome.
 *
 * Swap: replace <TabStrip scrollable> with a conditional renderer.
 */

const VALID_VIEWS = new Set<SearchView>([
  'search',
  'scan',
  'favorites',
  'staples',
  'custom',
  'my-meals',
  'my-recipes',
  'recent',
])

const VALID_MEALS = new Set(['breakfast', 'lunch', 'dinner', 'snack'])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

function parseView(raw: string | undefined): SearchView {
  return raw && VALID_VIEWS.has(raw as SearchView) ? (raw as SearchView) : 'search'
}

function parseMeal(raw: string | undefined): string {
  return raw && VALID_MEALS.has(raw) ? raw : 'breakfast'
}

function parseDate(raw: string | undefined): string {
  return raw && DATE_RE.test(raw) ? raw : todayISO()
}

export default async function V2CaloriesSearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string
    q?: string
    meal?: string
    date?: string
    saved?: string
  }>
}) {
  const params = await searchParams
  const view = parseView(params.view)
  const meal = parseMeal(params.meal)
  const date = parseDate(params.date)
  const query = (params.q ?? '').trim()
  const saved = params.saved === '1'

  return (
    <MobileShell
      top={
        <TopAppBar
          title="Find a food"
          leading={
            <Link
              href="/v2/calories"
              aria-label="Back to calories"
              style={{
                color: 'var(--v2-text-secondary)',
                textDecoration: 'none',
                minHeight: 'var(--v2-touch-target-min)',
                display: 'inline-flex',
                alignItems: 'center',
                padding: 'var(--v2-space-2)',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          }
        />
      }
    >
      <SearchTopTabs active={view} />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-4)',
          padding: 'var(--v2-space-4)',
          paddingBottom: 'var(--v2-space-16)',
        }}
      >
        {saved && <Banner intent="success" title="Saved." />}

        <SearchPanel view={view} query={query} meal={meal} date={date} />
      </div>
    </MobileShell>
  )
}

async function SearchPanel({
  view,
  query,
  meal,
  date,
}: {
  view: SearchView
  query: string
  meal: string
  date: string
}) {
  if (view === 'search') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
        <SearchInput initialQuery={query} meal={meal} />
        <SearchResults query={query} meal={meal} date={date} />
      </div>
    )
  }
  if (view === 'scan') return <ScanStubSection meal={meal} />
  if (view === 'favorites') return <FavoritesSection meal={meal} date={date} />
  if (view === 'staples') return <StaplesSection meal={meal} />
  if (view === 'custom') return <CustomFoodsSection meal={meal} />
  if (view === 'my-meals') return <MyMealsSection />
  if (view === 'my-recipes') return <MyRecipesSection />
  if (view === 'recent') return <RecentMealsSection meal={meal} />
  return null
}

async function SearchResults({
  query,
  meal,
  date,
}: {
  query: string
  meal: string
  date: string
}) {
  if (query.length < 2) {
    return (
      <EmptyState
        headline="Type a food to search"
        subtext="USDA has more than 380,000."
      />
    )
  }
  // Run USDA + Open Food Facts queries in parallel. USDA is the
  // authoritative nutrient source and the only one with a detail-page
  // route via fdcId, so it remains the primary source. OFF supplements
  // photos for the USDA rows (via lookupFoodPhotos -- GTIN-first when
  // USDA gave us a UPC, name-fallback otherwise). The OFF search list
  // itself is also exposed below the USDA list so the brand-centric
  // long tail is discoverable.
  let results: FoodSearchResult[] = []
  let offResults: OpenFoodProduct[] = []
  let usdaError: Error | null = null
  const [usdaSettled, offSettled] = await Promise.allSettled([
    searchFoods(query, 20),
    searchProducts(query, 6),
  ])
  if (usdaSettled.status === 'fulfilled') {
    results = usdaSettled.value
  } else {
    usdaError = usdaSettled.reason instanceof Error
      ? usdaSettled.reason
      : new Error(typeof usdaSettled.reason === 'string' ? usdaSettled.reason : 'Search failed.')
    // Structured monitoring: USDA failures must never silently degrade
    // to "no results" without an obvious signal in production logs. The
    // marker tag below is grep-able in `vercel logs --query`.
    console.error('[USDA_SEARCH_ERROR]', JSON.stringify({
      query,
      message: usdaError.message,
      name: usdaError.name,
    }))
  }
  if (offSettled.status === 'fulfilled') {
    offResults = offSettled.value.filter((p) => p.name && p.name !== 'Unknown')
  }
  // Hard error: USDA threw and no OFF fallback. Surface in NC voice
  // ("trouble" framing) instead of bubbling the raw transport error.
  if (usdaError && results.length === 0 && offResults.length === 0) {
    return (
      <EmptyState
        headline="Food search is having trouble"
        subtext="USDA's database isn't responding right now. Try the barcode scanner from the Scan tab, or check back in a few minutes."
      />
    )
  }
  // Empty result set despite a non-trivial query is also worth a log
  // so a future cache poisoning or query regression doesn't silently
  // break calorie logging again.
  if (results.length === 0 && offResults.length === 0) {
    console.warn('[USDA_SEARCH_EMPTY]', JSON.stringify({ query }))
    return (
      <EmptyState
        headline={`No matches for "${query}"`}
        subtext="USDA is US-centric. Try a shorter name, or add it as a custom food."
      />
    )
  }

  // Photo lookup for the USDA rows. Batched into a single helper call
  // so we share a single Supabase round trip for the cache read.
  const photoMap = await lookupFoodPhotos(
    results.map((r) => ({ fdcId: r.fdcId, name: r.description, gtin: r.gtinUpc })),
  ).catch(() => new Map<string, { url: string | null; source: 'off' | null }>())

  // De-dupe OFF results that already appear in the USDA list (GTIN
  // match or close brand+name match). Avoids "Cheerios" twice.
  const usdaGtins = new Set(results.map((r) => r.gtinUpc).filter((g): g is string => !!g))
  const usdaSignatures = new Set(
    results.map((r) => signatureOf(r.description, r.brandName)),
  )
  const offUnique = offResults.filter((p) => {
    if (p.barcode && usdaGtins.has(p.barcode)) return false
    return !usdaSignatures.has(signatureOf(p.name, p.brands))
  })

  return (
    <div>
      {results.map((r) => (
        <FoodSearchResultRow
          key={r.fdcId}
          result={r}
          meal={meal}
          date={date}
          photoUrl={photoMap.get(String(r.fdcId))?.url ?? null}
          query={query}
        />
      ))}
      {offUnique.length > 0 && (
        <OffResultsSection products={offUnique} meal={meal} />
      )}
    </div>
  )
}

function signatureOf(name: string | null | undefined, brand: string | null | undefined): string {
  return `${(name ?? '').toLowerCase().trim()}|${(brand ?? '').toLowerCase().trim()}`
}

function OffResultsSection({
  products,
  meal,
}: {
  products: OpenFoodProduct[]
  meal: string
}) {
  // OFF-only results are reachable through the existing barcode scan
  // flow. They do not have a USDA fdcId so the standard /food/[fdcId]
  // route can't hydrate them. Surfacing them here lets the brand-
  // centric long tail show up in search without forking the detail-
  // page architecture in this PR.
  return (
    <section style={{ marginTop: 'var(--v2-space-4)' }}>
      <h3
        style={{
          margin: '0 0 var(--v2-space-2)',
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--v2-tracking-wide)',
          fontWeight: 'var(--v2-weight-semibold)',
        }}
      >
        Also from Open Food Facts
      </h3>
      <div>
        {products.map((p) => (
          <Link
            key={p.barcode || `${p.name}-${p.brands}`}
            href={p.barcode
              ? `/v2/calories/photo?code=${encodeURIComponent(p.barcode)}&meal=${meal}`
              : `/v2/calories/photo?meal=${meal}`}
            style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--v2-space-3)',
                padding: 'var(--v2-space-3) 0',
                borderBottom: '1px solid var(--v2-border-subtle)',
                minHeight: 'var(--v2-touch-target-min)',
              }}
            >
              {p.imageUrl ? (
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    flexShrink: 0,
                    background: 'var(--v2-bg-card-muted, rgba(255,255,255,0.04))',
                    border: '1px solid var(--v2-border-subtle)',
                  }}
                >
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    width={32}
                    height={32}
                    loading="lazy"
                    decoding="async"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </div>
              ) : (
                <div
                  aria-hidden
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'var(--v2-bg-card-muted, rgba(255,255,255,0.04))',
                    border: '1px solid var(--v2-border-subtle)',
                    flexShrink: 0,
                  }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 'var(--v2-text-base)',
                    color: 'var(--v2-text-primary)',
                    fontWeight: 'var(--v2-weight-medium)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.name}
                </div>
                <div
                  style={{
                    fontSize: 'var(--v2-text-sm)',
                    color: 'var(--v2-text-muted)',
                    marginTop: 2,
                  }}
                >
                  {[p.brands, 'Open Food Facts'].filter(Boolean).join(' / ')}
                </div>
              </div>
              {typeof p.calories === 'number' && Number.isFinite(p.calories) ? (
                <span
                  style={{
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: 'var(--v2-text-base)',
                    color: 'var(--v2-text-secondary)',
                    fontWeight: 'var(--v2-weight-semibold)',
                    flexShrink: 0,
                  }}
                >
                  {Math.round(p.calories)}
                  <span
                    style={{
                      fontSize: 'var(--v2-text-xs)',
                      color: 'var(--v2-text-muted)',
                      marginLeft: 4,
                      fontWeight: 'var(--v2-weight-medium)',
                    }}
                  >
                    cal
                  </span>
                </span>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
