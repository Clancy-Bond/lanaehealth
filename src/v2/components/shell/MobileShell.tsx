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
        // Cap the shell at the viewport width so a runaway child can never
        // widen the document. Combined with `overflow-wrap: anywhere` in
        // tokens.css this is belt-and-suspenders, not a band-aid: this
        // wrapper is the v2 root, not <body> or <html>, and it constrains
        // its own subtree without suppressing any layout signal.
        width: '100%',
        maxWidth: '100vw',
        minWidth: 0,
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
          // min-width: 0 lets <main> shrink below its intrinsic content
          // width when a child contains long unbreakable strings. Without
          // this, flex column children default to min-width: auto and
          // refuse to shrink, which would force horizontal scroll on a
          // 390pt iPhone the moment a single long URL or lab value
          // appears in markdown.
          minWidth: 0,
          overflowY: scroll ? 'auto' : 'hidden',
          // Deliberately no overflow-x suppression here. The previous
          // shell pinned `overflow-x: hidden` on <main>, which silently
          // clipped runaway children instead of letting them surface as
          // a regression. The foundation rule in tokens.css
          // (`overflow-wrap: anywhere` plus `min-width: 0` on this
          // <main>) is what keeps content inside the viewport; if a
          // future component overflows, it should fail the
          // tests/e2e/viewport.spec.ts guard rather than be muted by a
          // chrome-level clip.
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
