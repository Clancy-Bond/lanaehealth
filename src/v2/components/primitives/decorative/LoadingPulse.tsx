'use client'

/*
 * LoadingPulse
 *
 * Branded loading state. Replaces generic shimmer Skeletons in places
 * where we want the wait to feel intentional rather than empty: a
 * soft sage circle pulses outward while a centered dot stays sharp.
 *
 * Use this when a card is the only loading element on the surface;
 * for a stack of skeletons, the regular Skeleton primitive still
 * reads better as a placeholder grid.
 *
 * Reduced motion: renders the dot with no halo and no animation.
 */
import { motion, useReducedMotion } from 'motion/react'

export interface LoadingPulseProps {
  /** Pixel size of the inner dot. Default 12. */
  size?: number
  /** Optional caption rendered under the pulse. */
  label?: string
}

export default function LoadingPulse({ size = 12, label }: LoadingPulseProps) {
  const reduce = useReducedMotion()

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--v2-space-2)',
        padding: 'var(--v2-space-4)',
      }}
    >
      <span
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size * 3,
          height: size * 3,
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
              background: 'var(--v2-accent-success)',
            }}
            initial={{ opacity: 0.5, scale: 1 }}
            animate={{ opacity: 0, scale: 3 }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <span
          aria-hidden
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: 'var(--v2-accent-success)',
          }}
        />
      </span>
      {label && (
        <span
          style={{
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--v2-tracking-wide)',
          }}
        >
          {label}
        </span>
      )}
    </div>
  )
}
