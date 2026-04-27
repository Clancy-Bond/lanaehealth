'use client'

/*
 * StandardTabBar
 *
 * The five-slot bottom navigation used across v2 sections. Wraps
 * BottomTabBar with the canonical tab list so individual pages do
 * not redefine tab labels and active-match patterns.
 *
 * Slot contract:
 *   Home / Cycle / [center FAB] / Food / More
 *
 * Pages render this via MobileShell's `bottom` slot. The center
 * action stays as a FAB tab-center variant so the user's thumb
 * lands on the most frequent action regardless of section.
 */
import { useRouter } from 'next/navigation'
import { Home, RotateCcw, UtensilsCrossed, MoreHorizontal } from 'lucide-react'
import BottomTabBar, { type Tab } from './BottomTabBar'
import FAB from './FAB'

const ICON_SIZE = 22
const ICON_STROKE = 1.75

export interface StandardTabBarProps {
  /**
   * Optional unread message count for the Cycle tab. Wave 2 of the
   * cycle deep rebuild uses this for the smart-logging Messages
   * inbox bell badge. Pages that omit it keep the canonical
   * zero-badge default.
   */
  cycleBadgeCount?: number
  /**
   * Surface flavor forwarded to BottomTabBar. Pass `explanatory` on
   * pages that wrap content in `.v2-surface-explanatory` (the cycle
   * surface today) so the bottom bar inherits the cream NC palette
   * instead of the dark Oura chrome.
   */
  surface?: 'dark' | 'explanatory'
}

const TABS: Tab[] = [
  {
    label: 'Home',
    href: '/v2',
    icon: <Home size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />,
    matches: /^\/v2$/,
  },
  {
    label: 'Cycle',
    href: '/v2/cycle',
    icon: <RotateCcw size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />,
    matches: /^\/v2\/cycle(\/.*)?$/,
  },
  {
    label: 'Food',
    href: '/v2/calories',
    icon: <UtensilsCrossed size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />,
    matches: /^\/v2\/calories(\/.*)?$/,
  },
  {
    label: 'More',
    href: '/v2/settings',
    icon: <MoreHorizontal size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />,
    matches: /^\/v2\/(settings|topics|labs|imaging|records|patterns|sleep|timeline|doctor|import)(\/.*)?$/,
  },
]

export default function StandardTabBar({ cycleBadgeCount, surface }: StandardTabBarProps = {}) {
  const router = useRouter()
  const tabs: Tab[] =
    cycleBadgeCount && cycleBadgeCount > 0
      ? TABS.map((t) => (t.href === '/v2/cycle' ? { ...t, badgeCount: cycleBadgeCount } : t))
      : TABS
  return (
    <BottomTabBar
      tabs={tabs}
      surface={surface}
      centerAction={
        <FAB
          variant="tab-center"
          label="Log today"
          onClick={() => router.push('/v2/log')}
        />
      }
    />
  )
}
