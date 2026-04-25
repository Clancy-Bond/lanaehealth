'use client'

/*
 * CelebrationConfetti
 *
 * Brief confetti burst overlay used when the user crosses a streak
 * milestone (e.g. seven consecutive days of logging). Renders a
 * dozen colored chips that fan out from the origin and fade. The
 * burst lasts ~1.4s and then unmounts the children automatically
 * via `onComplete` so the parent can hide it.
 *
 * Reduced motion: the burst does not animate. No chips render at
 * all so the surface stays still.
 */
import { useEffect } from 'react'
import { motion, useReducedMotion } from 'motion/react'

export interface CelebrationConfettiProps {
  /** Number of chips. Default 14. */
  count?: number
  /** Diameter of the burst envelope in px. Default 220. */
  size?: number
  /** Called when the animation ends; use to hide the overlay. */
  onComplete?: () => void
}

const PALETTE = [
  '#F0955A', // accent orange
  '#6ACF89', // sage
  '#4DB8A8', // teal
  '#E86377', // berry
  '#F2C94C', // honey
]

export default function CelebrationConfetti({
  count = 14,
  size = 220,
  onComplete,
}: CelebrationConfettiProps) {
  const reduce = useReducedMotion()

  useEffect(() => {
    if (!onComplete) return
    const handle = setTimeout(onComplete, reduce ? 0 : 1500)
    return () => clearTimeout(handle)
  }, [onComplete, reduce])

  if (reduce) return null

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 70,
      }}
    >
      <div style={{ position: 'relative', width: size, height: size }}>
        {Array.from({ length: count }).map((_, i) => {
          const angle = (i * 360) / count
          const rad = (angle * Math.PI) / 180
          const distance = size / 2 - 10
          const dx = Math.cos(rad) * distance
          const dy = Math.sin(rad) * distance
          const color = PALETTE[i % PALETTE.length]
          return (
            <motion.span
              key={i}
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.4 }}
              animate={{
                x: dx,
                y: dy,
                opacity: 0,
                rotate: angle * 1.4,
                scale: 1,
              }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: 8,
                height: 14,
                marginLeft: -4,
                marginTop: -7,
                borderRadius: 2,
                background: color,
                boxShadow: '0 1px 2px rgba(0,0,0,0.20)',
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
