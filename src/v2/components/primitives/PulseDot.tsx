'use client'

/*
 * PulseDot
 *
 * Soft pulsing dot for "live", "syncing", or "watching" states. The
 * outer ring expands and fades while the inner dot stays sharp, so
 * the eye reads the dot as the source of a gentle aura.
 *
 * Reduced motion: renders only the inner dot, no halo, no animation.
 */
import { motion, useReducedMotion } from 'motion/react'

export type PulseDotTone = 'success' | 'warning' | 'danger' | 'primary'

export interface PulseDotProps {
  tone?: PulseDotTone
  /** Pixel size of the inner dot. Default 8. */
  size?: number
  /** Optional accessible label for screen readers. */
  ariaLabel?: string
}

const TONE: Record<PulseDotTone, string> = {
  success: 'var(--v2-accent-success)',
  warning: 'var(--v2-accent-warning)',
  danger: 'var(--v2-accent-danger)',
  primary: 'var(--v2-accent-primary)',
}

export default function PulseDot({ tone = 'success', size = 8, ariaLabel }: PulseDotProps) {
  const reduce = useReducedMotion()
  const color = TONE[tone]

  return (
    <span
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size * 2,
        height: size * 2,
      }}
    >
      {!reduce && (
        <motion.span
          aria-hidden
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: '50%',
            background: color,
          }}
          initial={{ opacity: 0.6, scale: 1 }}
          animate={{ opacity: 0, scale: 2.4 }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      <span
        aria-hidden
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 0 2px rgba(0,0,0,0.18)`,
        }}
      />
    </span>
  )
}
