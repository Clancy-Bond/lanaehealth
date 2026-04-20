/*
 * MobileShell
 *
 * Root v2 layout wrapper. Applies the .v2 class (scoping tokens.css),
 * sets the dark color scheme, and honors iOS safe-area insets.
 *
 * It composes TopAppBar (optional) + scrollable content region +
 * BottomTabBar (optional) + FAB (optional). Individual v2 routes
 * decide which chrome slots they render.
 */
import { ReactNode } from 'react'

export interface MobileShellProps {
  children: ReactNode
  top?: ReactNode
  bottom?: ReactNode
  fab?: ReactNode
  /**
   * When false, the page manages its own scroll (e.g. list with sticky
   * header). Default: true (the shell provides the scroll container).
   */
  scroll?: boolean
}

export default function MobileShell({ children, top, bottom, fab, scroll = true }: MobileShellProps) {
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
