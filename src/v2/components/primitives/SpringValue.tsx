'use client'

/*
 * SpringValue
 *
 * Wraps a metric or value display. On the FIRST render, the wrapper
 * renders flat. On every subsequent change to `value`, it triggers
 * a brief spring scale (1.0 -> 1.08 -> 1.0) so the user notices the
 * number ticked up or down.
 *
 * Why first-render is flat: Oura's metric tiles do not bounce on
 * page entry. They bounce when something updates. We mirror that.
 *
 * Use this around any rendered metric primitive whose underlying
 * value mutates client-side (e.g. AnimatedNumber, MetricRing).
 *
 * Reduced motion: never scales. Always renders inline.
 */
import { ReactNode, useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'

export interface SpringValueProps {
  /** Stable identity for the underlying value. Must be primitive. */
  value: string | number | boolean | null
  children: ReactNode
}

export default function SpringValue({ value, children }: SpringValueProps) {
  const reduce = useReducedMotion()
  const initialRef = useRef<string | number | boolean | null>(value)
  const [pulseKey, setPulseKey] = useState(0)

  useEffect(() => {
    if (value === initialRef.current) return
    initialRef.current = value
    setPulseKey((k) => k + 1)
  }, [value])

  if (reduce) {
    return <span style={{ display: 'inline-flex' }}>{children}</span>
  }

  return (
    <motion.span
      key={pulseKey}
      initial={pulseKey === 0 ? false : { scale: 1 }}
      animate={pulseKey === 0 ? false : { scale: [1, 1.08, 1] }}
      transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
      style={{ display: 'inline-flex' }}
    >
      {children}
    </motion.span>
  )
}
