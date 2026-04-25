'use client'

/*
 * BottomTabBar
 *
 * Five-slot tab bar mirroring Oura's Today/Vitals/My Health pattern
 * combined with NC's Today/Calendar/Messages/Learn. We keep the
 * primary action in the center slot so the user's thumb falls on
 * the most frequent action (mirrors NC's purple FAB-in-tab-bar).
 *
 * Slot contract (fixed across v2):
 *   Home / Cycle / [center FAB] / Food / More
 *
 * Active-tab affordance: a small orange underline that slides
 * between active tabs (motion layoutId), filled icon + label in
 * primary text color. Inactive: muted icon, label in --v2-text-muted.
 */
import { usePathname, useRouter } from 'next/navigation'
import { ReactNode } from 'react'
import { motion } from 'motion/react'
import { lightTap } from '@/v2/lib/haptics'

export interface Tab {
  label: string
  href: string
  icon: ReactNode
  /**
   * Paths whose active state should light up this tab. Useful when
   * a tab represents a section (e.g. /v2/cycle lights up for
   * /v2/cycle/log too).
   */
  matches?: RegExp
}

export interface BottomTabBarProps {
  tabs: Tab[]
  centerAction?: ReactNode
}

export default function BottomTabBar({ tabs, centerAction }: BottomTabBarProps) {
  const pathname = usePathname() ?? ''
  const router = useRouter()

  const renderTab = (tab: Tab) => {
    const active = tab.matches ? tab.matches.test(pathname) : pathname === tab.href
    return (
      <button
        key={tab.href}
        type="button"
        onClick={() => {
          lightTap()
          router.push(tab.href)
        }}
        className="v2-btn-press"
        style={{
          flex: 1,
          minHeight: 'var(--v2-touch-target-min)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          background: 'transparent',
          border: 'none',
          color: active ? 'var(--v2-text-primary)' : 'var(--v2-text-muted)',
          cursor: 'pointer',
          position: 'relative',
          padding: 'var(--v2-space-1) 0',
          transition: 'color var(--v2-duration-fast) var(--v2-ease-standard), transform 120ms var(--v2-ease-standard)',
        }}
        aria-pressed={active}
        aria-label={tab.label}
      >
        {active && (
          <motion.span
            layoutId="v2-tabbar-active-indicator"
            transition={{ type: 'spring', stiffness: 520, damping: 38, mass: 0.8 }}
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              translateX: '-50%',
              width: 20,
              height: 2,
              background: 'var(--v2-accent-orange)',
              borderRadius: 'var(--v2-radius-full)',
            }}
          />
        )}
        <span style={{ fontSize: 20, lineHeight: 1, display: 'flex' }}>{tab.icon}</span>
        <span style={{ fontSize: 'var(--v2-text-xs)', lineHeight: 1.1 }}>{tab.label}</span>
      </button>
    )
  }

  const left = tabs.slice(0, 2)
  const right = tabs.slice(2, 4)

  return (
    <nav
      style={{
        position: 'sticky',
        bottom: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'stretch',
        background: 'rgba(17, 17, 20, 0.72)',
        borderTop: '1px solid var(--v2-border-subtle)',
        height: `calc(var(--v2-tabbar-height) + var(--v2-safe-bottom))`,
        paddingBottom: 'var(--v2-safe-bottom)',
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
      }}
      aria-label="Primary"
    >
      {left.map(renderTab)}
      {centerAction && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {centerAction}
        </div>
      )}
      {right.map(renderTab)}
    </nav>
  )
}
