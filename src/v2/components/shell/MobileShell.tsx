/*
 * MobileShell
 *
 * Root v2 layout wrapper. Applies the .v2 class (scoping tokens.css),
 * sets the dark color scheme, and honors iOS safe-area insets.
 *
 * It composes TopAppBar (optional) + scrollable content region +
 * BottomTabBar (default StandardTabBar) + FAB (optional). Individual
 * v2 routes decide which chrome slots they render.
 *
 * Foundation amendment (authorized 2026-04-23): the `bottom` slot
 * defaults to <StandardTabBar /> so every v2 route renders the
 * primary navigation by default. Pages that legitimately need a bare
 * shell (printable doctor reports, modal-style flows) opt out by
 * passing `bottom={null}` explicitly. This closes the trap where the
 * Food tab landed users on /v2/calories with no way back.
 */
import { ReactNode } from 'react'
import StandardTabBar from './StandardTabBar'

export interface MobileShellProps {
  children: ReactNode
  top?: ReactNode
  /**
   * Bottom navigation slot. Defaults to <StandardTabBar />. Pass
   * `null` to opt out (e.g. printable reports, immersive flows).
   */
  bottom?: ReactNode
  fab?: ReactNode
  /**
   * When false, the page manages its own scroll (e.g. list with sticky
   * header). Default: true (the shell provides the scroll container).
   */
  scroll?: boolean
}

const DEFAULT_BOTTOM = <StandardTabBar />

export default function MobileShell({
  children,
  top,
  bottom = DEFAULT_BOTTOM,
  fab,
  scroll = true,
}: MobileShellProps) {
  return (
    <div
      className="v2"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'var(--v2-safe-top)',
        paddingLeft: 'var(--v2-safe-left)',
        paddingRight: 'var(--v2-safe-right)',
      }}
    >
      {top}
      <main
        style={{
          flex: 1,
          overflowY: scroll ? 'auto' : 'hidden',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: bottom ? `calc(var(--v2-tabbar-height) + var(--v2-safe-bottom))` : 'var(--v2-safe-bottom)',
        }}
      >
        {children}
      </main>
      {bottom}
      {fab}
    </div>
  )
}
