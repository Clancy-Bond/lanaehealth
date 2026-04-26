'use client'

/*
 * RouteSlide
 *
 * Directional page transition wrapper. We persist the previous
 * pathname in sessionStorage so we can compare depths across page
 * mounts (each route change unmounts the previous page and remounts a
 * fresh component, so module-level refs do not survive). On mount we
 * read the previous path, then compute direction:
 *
 *   - deeper path (e.g. /v2/cycle -> /v2/cycle/log)         slides left
 *   - shallower path (back navigation)                       slides right
 *   - sibling path (same depth, different segment)           subtle fade
 *
 * Like RouteFade, this is intentionally a mount-time effect rather
 * than a true cross-fade. We do not hold the previous page in memory.
 * The next page paints with the slide; the previous page unmounts as
 * Next.js completes the navigation.
 *
 * Reduced motion: instant render, no slide. We respect both
 * useReducedMotion (motion library) and the underlying
 * prefers-reduced-motion media query.
 */
import { ReactNode, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { motion, useReducedMotion } from 'motion/react'

export interface RouteSlideProps {
  children: ReactNode
}

type SlideDirection = 'left' | 'right' | 'fade' | 'none'

const PREV_PATH_KEY = 'v2:routeSlide:prevPath'

function pathDepth(pathname: string): number {
  // /v2 -> 1, /v2/cycle -> 2, /v2/cycle/log -> 3.
  // Trim trailing slash so depth is stable across routing variations.
  const trimmed = pathname.replace(/\/+$/, '')
  if (trimmed === '' || trimmed === '/') return 0
  return trimmed.split('/').filter(Boolean).length
}

function readPrevPath(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage.getItem(PREV_PATH_KEY)
  } catch {
    return null
  }
}

function writePrevPath(pathname: string): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(PREV_PATH_KEY, pathname)
  } catch {
    // sessionStorage can throw in private browsing; the slide simply
    // falls back to "none" on the next mount, never breaks the page.
  }
}

export default function RouteSlide({ children }: RouteSlideProps) {
  const reduce = useReducedMotion()
  const pathname = usePathname() ?? ''
  // Compute direction once per mount, on the client only. Server
  // render gets 'none' so SSR HTML matches the first client paint
  // (avoids hydration mismatch warnings).
  const [direction, setDirection] = useState<SlideDirection>('none')

  useEffect(() => {
    const prev = readPrevPath()
    if (prev != null && prev !== pathname) {
      const prevDepth = pathDepth(prev)
      const currDepth = pathDepth(pathname)
      if (currDepth > prevDepth) setDirection('left')
      else if (currDepth < prevDepth) setDirection('right')
      else setDirection('fade')
    }
    writePrevPath(pathname)
    // We intentionally only run this effect on mount per route. Even
    // if pathname changes via shallow routing, the page subtree
    // remounts, so this effect is the right hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (reduce || direction === 'none') {
    return (
      <motion.div initial={false} style={{ display: 'contents' }}>
        {children}
      </motion.div>
    )
  }

  if (direction === 'fade') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        style={{ display: 'contents' }}
      >
        {children}
      </motion.div>
    )
  }

  // Slide left when going deeper (incoming page enters from right).
  // Slide right when going shallower (incoming page enters from left).
  const xFrom = direction === 'left' ? 24 : -24

  return (
    <motion.div
      initial={{ opacity: 0, x: xFrom }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      style={{ display: 'contents' }}
    >
      {children}
    </motion.div>
  )
}
