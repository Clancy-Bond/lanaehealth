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
import BottomTabBar, { type Tab } from './BottomTabBar'
import FAB from './FAB'

const TABS: Tab[] = [
  {
    label: 'Home',
    href: '/v2',
    icon: 'H',
    matches: /^\/v2$/,
  },
  {
    label: 'Cycle',
    href: '/v2/cycle',
    icon: 'C',
    matches: /^\/v2\/cycle(\/.*)?$/,
  },
  {
    label: 'Food',
    href: '/v2/calories',
    icon: 'F',
    matches: /^\/v2\/calories(\/.*)?$/,
  },
  {
    label: 'More',
    href: '/v2/settings',
    icon: 'M',
    matches: /^\/v2\/(settings|topics|labs|imaging|records|patterns|sleep|timeline|doctor|import)(\/.*)?$/,
  },
]

export default function StandardTabBar() {
  const router = useRouter()
  return (
    <BottomTabBar
      tabs={TABS}
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
