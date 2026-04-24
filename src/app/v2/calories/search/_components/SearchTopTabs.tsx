'use client'

/*
 * SearchTopTabs
 *
 * Wraps the section-local TabStrip primitive. Owns the URL nav so the
 * page stays a server component. Reads `?view=` at parent render time;
 * on tab click, pushes the new `view` while preserving `meal` and `q`
 * so the user's typed query and target meal persist across tabs.
 *
 * Sticky placement below the TopAppBar mirrors MFN: the tabs stay
 * visible while the panel scrolls.
 *
 * MFN parity (PR: v2-calories-mfn-fidelity-2): each tab now pairs a
 * small lucide-style SVG icon with the label, stacked vertically. This
 * matches MyNetDiary's search top-tabs (Search / Scan / Favs /
 * Calories / Staples / Custom...) and gives the strip the same dense,
 * scannable rhythm.
 */

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import TabStrip, { type TabItem } from '@/app/v2/calories/_components/TabStrip'

export type SearchView =
  | 'search'
  | 'scan'
  | 'favorites'
  | 'staples'
  | 'custom'
  | 'my-meals'
  | 'my-recipes'
  | 'recent'

const ICON_SIZE = 16

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

const SearchIcon = (
  <Icon>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </Icon>
)
const ScanIcon = (
  <Icon>
    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    <path d="M7 8v8M11 8v8M15 8v8M19 8v0M3 8v0" />
  </Icon>
)
const StarIcon = (
  <Icon>
    <path d="M12 2l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-7z" />
  </Icon>
)
const StaplesIcon = (
  <Icon>
    <path d="M5 8a7 7 0 0 1 14 0v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" />
    <path d="M9 5a3 3 0 0 1 6 0" />
  </Icon>
)
const CustomIcon = (
  <Icon>
    <path d="M11 3l3 3-9 9H2v-3z" />
    <path d="M14 6l3-3 3 3-3 3" />
  </Icon>
)
const MealsIcon = (
  <Icon>
    <path d="M3 11h18" />
    <path d="M5 11a7 7 0 0 1 14 0" />
    <path d="M3 15h18" />
    <path d="M5 15v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
  </Icon>
)
const RecipesIcon = (
  <Icon>
    <path d="M4 7c0-2 2-4 4-4h8c2 0 4 2 4 4v3H4z" />
    <path d="M5 10v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9" />
  </Icon>
)
const RecentIcon = (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
)

const TABS: TabItem<SearchView>[] = [
  { key: 'search', label: 'Search', icon: SearchIcon },
  { key: 'scan', label: 'Scan', icon: ScanIcon },
  { key: 'favorites', label: 'Favorites', icon: StarIcon },
  { key: 'staples', label: 'Staples', icon: StaplesIcon },
  { key: 'custom', label: 'Custom', icon: CustomIcon },
  { key: 'my-meals', label: 'My meals', icon: MealsIcon },
  { key: 'my-recipes', label: 'Recipes', icon: RecipesIcon },
  { key: 'recent', label: 'Recent', icon: RecentIcon },
]

export default function SearchTopTabs({ active }: { active: SearchView }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handleChange = (key: SearchView) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', key)
    // Drop the ?saved=1 flash on tab change so the banner doesn't
    // stick around once the user starts browsing.
    params.delete('saved')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div
      style={{
        position: 'sticky',
        top: 'var(--v2-topbar-height)',
        zIndex: 9,
        background: 'var(--v2-bg-primary)',
        borderBottom: '1px solid var(--v2-border-subtle)',
        padding: '0 var(--v2-space-4)',
      }}
    >
      <TabStrip
        tabs={TABS}
        active={active}
        onChange={handleChange}
        ariaLabel="Food search views"
      />
    </div>
  )
}
