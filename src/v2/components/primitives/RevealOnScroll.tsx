'use client'

/*
 * RevealOnScroll
 *
 * Wraps any block of content. The first time the block enters the
 * viewport (using IntersectionObserver via Motion's useInView), it
 * fades and slides up. After that it stays put.
 *
 * Use cases:
 *   - Home cards below the fold
 *   - Doctor mode panels (long page, multiple panels)
 *   - Patterns insight cards
 *   - Calorie analysis charts
 *   - Sleep contributors below the hero ring
 *
 * Reduced motion: render at full opacity with no transform. The
 * `useInView` hook still fires but we skip the animation.
 */
import { ReactNode, useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'

export interface RevealOnScrollProps {
  children: ReactNode
  /** Animation delay in seconds. Useful for staggering siblings. */
  delay?: number
  /** Px offset to start below the final position. Default 16. */
  offsetY?: number
  /**
   * Margin string passed to IntersectionObserver. Negative values
   * fire the reveal slightly before the block touches the viewport
   * edge. Default "0px 0px -10% 0px" so cards reveal as they begin
   * to peek in.
   */
  rootMargin?: string
  /**
   * If true the element animates every time it enters the viewport.
   * Default false (one-shot, which feels better for content cards).
   */
  repeat?: boolean
  /** Optional inline style applied to the wrapping div. */
  style?: React.CSSProperties
  /** Optional className applied to the wrapping div. */
  className?: string
}

export default function RevealOnScroll({
  children,
  delay = 0,
  offsetY = 16,
  rootMargin = '0px 0px -10% 0px',
  repeat = false,
  style,
  className,
}: RevealOnScrollProps) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement | null>(null)
  const inView = useInView(ref, { once: !repeat, margin: rootMargin as `${number}px ${number}px ${number}px ${number}px` })

  if (reduce) {
    return (
      <div ref={ref} style={style} className={className}>
        {children}
      </div>
    )
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: offsetY }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: offsetY }}
      transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1], delay }}
      style={style}
      className={className}
    >
      {children}
    </motion.div>
  )
}
