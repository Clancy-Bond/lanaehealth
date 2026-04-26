'use client'

/*
 * RouteFade
 *
 * Subtle 200ms fade-in wrapper for v2 pages. Drop this just inside
 * a page's root return so the page lands gently after navigation
 * instead of snapping in. Reduced motion: instant render.
 *
 * We do NOT do route-level cross-fades (which would require keying on
 * pathname in layout). The lighter mount-fade gives the same feel
 * without holding the previous page in memory.
 */
import { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'

export interface RouteFadeProps {
  children: ReactNode
}

export default function RouteFade({ children }: RouteFadeProps) {
  const reduce = useReducedMotion()
  // SSR-safe: always render the motion.div wrapper on the server. On
  // the client, motion.div with reduced motion preferences is a no-op
  // visually (the framework respects the user's OS-level reduced
  // motion). Returning a different element shape based on `reduce`
  // would change the DOM tree between server and client, triggering
  // React hydration error #418.
  if (reduce) {
    return (
      <motion.div initial={false} style={{ display: 'contents' }}>
        {children}
      </motion.div>
    )
  }

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
