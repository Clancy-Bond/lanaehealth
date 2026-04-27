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
  /**
   * Optional unread badge count rendered on the icon. Used by
   * /v2/cycle to surface the smart-logging Messages inbox without
   * tipping the user into a push-notification model.
   */
  badgeCount?: number
}

export interface BottomTabBarProps {
  tabs: Tab[]
  centerAction?: ReactNode
  /**
   * Surface flavor. `dark` is the default Oura-style chrome (dark
   * translucent with backdrop blur). `explanatory` switches to NC's
   * cream surface so the bar matches a `.v2-surface-explanatory`
   * page (the cycle screen). Active tab still gets the primary text
   * color but uses the NC plum CTA so it reads as the brand color.
   */
  surface?: 'dark' | 'explanatory'
}

export default function BottomTabBar({ tabs, centerAction, surface = 'dark' }: BottomTabBarProps) {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const isExplanatory = surface === 'explanatory'

  const activeColor = isExplanatory
    ? 'var(--v2-surface-explanatory-cta, #5B2852)'
    : 'var(--v2-text-primary)'
  const inactiveColor = isExplanatory
    ? 'var(--v2-surface-explanatory-text-muted, rgba(45, 25, 60, 0.55))'
    : 'var(--v2-text-muted)'

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
          color: active ? activeColor : inactiveColor,
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
        <span style={{ fontSize: 20, lineHeight: 1, display: 'flex', position: 'relative' }}>
          {tab.icon}
          {tab.badgeCount != null && tab.badgeCount > 0 && (
            <span
              aria-label={`${tab.badgeCount} unread`}
              style={{
                position: 'absolute',
                top: -4,
                right: -8,
                minWidth: 16,
                height: 16,
                padding: '0 4px',
                borderRadius: 'var(--v2-radius-full)',
                background: 'var(--v2-accent-red, #E84570)',
                color: '#fff',
                fontSize: 10,
                lineHeight: '16px',
                fontWeight: 600,
                textAlign: 'center',
              }}
            >
              {tab.badgeCount > 9 ? '9+' : tab.badgeCount}
            </span>
          )}
        </span>
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
        background: isExplanatory
          ? 'var(--v2-surface-explanatory-card, #FFFFFF)'
          : 'rgba(17, 17, 20, 0.72)',
        borderTop: isExplanatory
          ? '1px solid var(--v2-surface-explanatory-border, rgba(45, 25, 60, 0.08))'
          : '1px solid var(--v2-border-subtle)',
        height: `calc(var(--v2-tabbar-height) + var(--v2-safe-bottom))`,
        paddingBottom: 'var(--v2-safe-bottom)',
        backdropFilter: isExplanatory ? 'none' : 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: isExplanatory ? 'none' : 'blur(20px) saturate(140%)',
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
