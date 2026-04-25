'use client'

/*
 * StreakBurst
 *
 * A small celebratory SVG used when the user crosses a logging
 * milestone (e.g. 7 days in a row). Renders a soft sunburst with a
 * count badge in the center. Animates in on mount with a spring
 * scale so it feels like a moment, not a static medal.
 *
 * Reduced motion: badge appears instantly with no scale animation.
 */
import { motion, useReducedMotion } from 'motion/react'

export interface StreakBurstProps {
  /** The streak count to render at center (e.g. 7). */
  count: number
  /** Optional label below the count (e.g. "DAYS"). */
  label?: string
  size?: number
}

export default function StreakBurst({ count, label = 'DAYS', size = 120 }: StreakBurstProps) {
  const reduce = useReducedMotion()
  const rays = Array.from({ length: 12 })
  const cx = 50
  const cy = 50

  return (
    <motion.div
      initial={reduce ? false : { scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={
        reduce
          ? { duration: 0 }
          : { type: 'spring', stiffness: 280, damping: 18, mass: 0.8 }
      }
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      role="img"
      aria-label={`${count}-${label.toLowerCase()} streak`}
    >
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
        <defs>
          <radialGradient id="v2-streak-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#F0955A" />
            <stop offset="100%" stopColor="#D9775C" />
          </radialGradient>
          <radialGradient id="v2-streak-glow" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="rgba(240, 149, 90, 0.50)" />
            <stop offset="100%" stopColor="rgba(240, 149, 90, 0)" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={48} fill="url(#v2-streak-glow)" />
        {rays.map((_, i) => {
          const angle = (i * 360) / rays.length
          const rad = (angle * Math.PI) / 180
          const inner = 28
          const outer = 42
          const x1 = cx + Math.cos(rad) * inner
          const y1 = cy + Math.sin(rad) * inner
          const x2 = cx + Math.cos(rad) * outer
          const y2 = cy + Math.sin(rad) * outer
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#F0955A"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.7"
            />
          )
        })}
        <circle cx={cx} cy={cy} r="22" fill="url(#v2-streak-core)" />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
          textShadow: '0 1px 2px rgba(0,0,0,0.30)',
        }}
      >
        <span
          style={{
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 'var(--v2-tracking-tight)',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {count}
        </span>
        <span
          style={{
            fontSize: 9,
            letterSpacing: 'var(--v2-tracking-wide)',
            textTransform: 'uppercase',
            marginTop: 2,
            opacity: 0.85,
          }}
        >
          {label}
        </span>
      </div>
    </motion.div>
  )
}
