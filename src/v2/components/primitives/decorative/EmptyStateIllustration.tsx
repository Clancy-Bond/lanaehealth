'use client'

/*
 * EmptyStateIllustration
 *
 * A small hand-drawn-feeling SVG used in empty states across v2. Two
 * variants:
 *
 *   "leaf"   : a sage leaf with a soft drop shadow. Use for cycle /
 *              hormonal empty states ("nothing logged yet").
 *
 *   "compass": a tiny compass needle. Use for navigation / discovery
 *              empty states ("nothing here yet, here is where to go").
 *
 * The graphic gently floats up and down on a 4-second loop : a small
 * piece of life inside an otherwise still surface. Reduced motion:
 * the graphic stays still.
 */
import { useReducedMotion } from 'motion/react'

export type EmptyStateIllustrationVariant = 'leaf' | 'compass'

export interface EmptyStateIllustrationProps {
  variant?: EmptyStateIllustrationVariant
  size?: number
}

export default function EmptyStateIllustration({
  variant = 'leaf',
  size = 96,
}: EmptyStateIllustrationProps) {
  const reduce = useReducedMotion()
  const className = reduce ? '' : 'v2-float-loop'

  if (variant === 'compass') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        role="presentation"
        aria-hidden
        className={className}
      >
        <defs>
          <radialGradient id="v2-compass-glow" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="rgba(77, 184, 168, 0.18)" />
            <stop offset="100%" stopColor="rgba(77, 184, 168, 0)" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#v2-compass-glow)" />
        <circle
          cx="50"
          cy="50"
          r="34"
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1.5"
          strokeDasharray="2 4"
        />
        <path d="M50 22 L54 50 L50 56 L46 50 Z" fill="#4DB8A8" opacity="0.9" />
        <path d="M50 78 L54 50 L50 44 L46 50 Z" fill="rgba(255,255,255,0.30)" />
        <circle cx="50" cy="50" r="3" fill="#F2F2F4" />
      </svg>
    )
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="presentation"
      aria-hidden
      className={className}
    >
      <defs>
        <linearGradient id="v2-leaf-fill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(106, 207, 137, 0.85)" />
          <stop offset="100%" stopColor="rgba(77, 184, 168, 0.55)" />
        </linearGradient>
      </defs>
      <ellipse cx="50" cy="86" rx="22" ry="3" fill="rgba(0,0,0,0.30)" />
      <path
        d="M50 14 C 28 28 22 52 30 78 C 52 80 78 60 80 30 C 70 18 58 14 50 14 Z"
        fill="url(#v2-leaf-fill)"
        stroke="rgba(255,255,255,0.10)"
        strokeWidth="1"
      />
      <path
        d="M48 22 C 52 38 54 56 46 76"
        stroke="rgba(255,255,255,0.30)"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M48 36 L62 30" stroke="rgba(255,255,255,0.20)" strokeWidth="1" fill="none" strokeLinecap="round" />
      <path d="M48 48 L66 42" stroke="rgba(255,255,255,0.20)" strokeWidth="1" fill="none" strokeLinecap="round" />
      <path d="M47 60 L63 56" stroke="rgba(255,255,255,0.20)" strokeWidth="1" fill="none" strokeLinecap="round" />
    </svg>
  )
}
