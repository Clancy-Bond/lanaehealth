import Link from 'next/link'
import { format } from 'date-fns'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { Banner, EmptyState } from '@/v2/components/primitives'
import { searchFoods, type FoodSearchResult } from '@/lib/api/usda-food'
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
  let results: FoodSearchResult[] = []
  let errMessage: string | null = null
  try {
    results = await searchFoods(query, 20)
  } catch (e) {
    errMessage = e instanceof Error ? e.message : 'Search failed.'
  }
  if (errMessage) {
    return <EmptyState headline="Search unavailable" subtext={errMessage} />
  }
  if (results.length === 0) {
    return (
      <EmptyState
        headline={`No matches for "${query}"`}
        subtext="USDA is US-centric. Try a shorter name, or add it as a custom food."
      />
    )
  }
  return (
    <div>
      {results.map((r) => (
        <FoodSearchResultRow key={r.fdcId} result={r} meal={meal} date={date} />
      ))}
    </div>
  )
}
