'use client'

/*
 * StaggeredList
 *
 * Wraps a set of children and reveals them with a soft upward slide
 * + fade, staggered by a configurable delay. Use for home cards,
 * meal lists, search results : anywhere a vertical stack lands at
 * once and benefits from a moment of visual rhythm.
 *
 * Reduced motion: instant render with full opacity. No transforms.
 */
import { Children, ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'

export interface StaggeredListProps {
  children: ReactNode
  /** Time between each child's reveal in seconds. Default 80ms. */
  stagger?: number
  /** Initial vertical offset in px. Default 8. */
  offsetY?: number
  /**
   * Container element. Defaults to a div with display: contents so the
   * wrapper does not introduce its own layout box.
   */
  as?: 'div' | 'ul' | 'ol'
  /** Optional inline style applied to the container element. */
  style?: React.CSSProperties
}

export default function StaggeredList({
  children,
  stagger = 0.08,
  offsetY = 8,
  as = 'div',
  style,
}: StaggeredListProps) {
  const reduce = useReducedMotion()
  const items = Children.toArray(children)

  if (reduce) {
    const Tag = as
    return <Tag style={style}>{children}</Tag>
  }

  const MotionTag = motion[as]

  return (
    <MotionTag
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: stagger, delayChildren: 0.05 },
        },
      }}
      style={style}
    >
      {items.map((child, i) => (
        <motion.div
          key={i}
          variants={{
            hidden: { opacity: 0, y: offsetY },
            visible: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.36, ease: [0.16, 1, 0.3, 1] },
            },
          }}
          style={{ display: 'contents' }}
        >
          {child}
        </motion.div>
      ))}
    </MotionTag>
  )
}
