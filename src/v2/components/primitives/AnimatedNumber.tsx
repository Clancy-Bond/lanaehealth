'use client'

/*
 * AnimatedNumber
 *
 * Counts up (or down) toward a target value with a celebratory ease.
 * Built on `motion`'s spring/animate primitives so we get hardware
 * accelerated transforms where possible plus a clean numeric tween.
 *
 * Use cases:
 *   - Sleep score reveal (0 -> last night's score)
 *   - Calorie remaining counter
 *   - Cycle day badges
 *
 * Reduced motion: when the user has prefers-reduced-motion: reduce,
 * we skip the tween entirely and snap to the final value. This is
 * mandatory across v2 per CLAUDE.md.
 */
import { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'motion/react'

export interface AnimatedNumberProps {
  /** The numeric target. Tween runs whenever this changes. */
  value: number
  /** Total animation duration in seconds. Default 1.2s. */
  duration?: number
  /** Decimal places to render. Default 0 (whole numbers). */
  decimals?: number
  /** Optional prefix (e.g. "+") rendered before the number. */
  prefix?: string
  /** Optional suffix (e.g. "%") rendered after the number. */
  suffix?: string
  /**
   * Optional formatter that receives the rounded number and returns the
   * display string. Overrides decimals + prefix + suffix.
   */
  format?: (n: number) => string
}

export default function AnimatedNumber({
  value,
  duration = 1.2,
  decimals = 0,
  prefix = '',
  suffix = '',
  format,
}: AnimatedNumberProps) {
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState<number>(reduce ? value : 0)
  const fromRef = useRef<number>(reduce ? value : 0)

  useEffect(() => {
    if (reduce) {
      setDisplay(value)
      fromRef.current = value
      return
    }
    const controls = animate(fromRef.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        setDisplay(latest)
      },
      onComplete: () => {
        fromRef.current = value
      },
    })
    return () => controls.stop()
  }, [value, duration, reduce])

  const rounded = decimals > 0 ? Number(display.toFixed(decimals)) : Math.round(display)
  const text = format ? format(rounded) : `${prefix}${rounded.toLocaleString()}${suffix}`
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{text}</span>
}
