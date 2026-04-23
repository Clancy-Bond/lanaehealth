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

const TABS: TabItem<SearchView>[] = [
  { key: 'search', label: 'Search' },
  { key: 'scan', label: 'Scan' },
  { key: 'favorites', label: 'Favorites' },
  { key: 'staples', label: 'Staple foods' },
  { key: 'custom', label: 'Custom foods' },
  { key: 'my-meals', label: 'My meals' },
  { key: 'my-recipes', label: 'My recipes' },
  { key: 'recent', label: 'Recent meals' },
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
