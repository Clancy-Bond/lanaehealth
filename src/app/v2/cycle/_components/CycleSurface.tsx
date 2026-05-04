/*
 * CycleSurface
 *
 * Shared cream-chrome wrapper used by every render path under
 * /v2/cycle (page.tsx, loading.tsx, error.tsx).
 *
 * Why this exists: the v2 design system gives MobileShell a `.v2`
 * outer div that hard-codes `background: var(--v2-bg-sky)` (the dark
 * Oura sky gradient). On cycle, where NC's chrome is cream throughout,
 * the dark gradient bleeds through behind the transparent TopAppBar
 * and produces a black band above the cream content.
 *
 * The fix is two-part. The element itself carries
 * `.v2-surface-explanatory` so its descendants get the NC light
 * palette via CSS-variable cascade. The element ALSO overrides
 * `--v2-bg-sky` to the cream surface color so the inner `.v2` div
 * MobileShell renders inside resolves to cream rather than dark.
 *
 * Loading and error fallbacks need the same wrapper because Next.js
 * renders them INSTEAD of page.tsx during their respective states,
 * and they are not nested inside any cycle page wrapper. A wrapped
 * `LoadingShell` / `ErrorState` keeps cream chrome consistent even
 * when data is loading or has thrown.
 *
 * Behaves identically to a plain div from a layout standpoint
 * (`min-height: 100vh` so cream fills short pages); the cream cascade
 * is purely CSS variables, so this works in server and client trees.
 */
import type { CSSProperties, ReactNode } from 'react'

export interface CycleSurfaceProps {
  children: ReactNode
  /** Optional style overrides; merged with the cream-chrome defaults. */
  style?: CSSProperties
}

export default function CycleSurface({ children, style }: CycleSurfaceProps) {
  return (
    <div
      className="v2-surface-explanatory"
      style={{
        minHeight: '100vh',
        // CSS-variable override: descendant `.v2` divs inside MobileShell
        // hard-code background: var(--v2-bg-sky). Setting this token at
        // the wrapper level cascades cream into MobileShell's inner
        // chrome so the page reads as one continuous NC surface.
        ['--v2-bg-sky' as string]: 'var(--v2-surface-explanatory-bg)',
        ...style,
      } as CSSProperties}
    >
      {children}
    </div>
  )
}
