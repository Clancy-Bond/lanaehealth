'use client'

/*
 * EmptyJourney
 *
 * Winding-path SVG with a small footprint marker at the start, used
 * for "you have not logged anything yet" surfaces where we want the
 * empty state to read as the beginning of a journey rather than an
 * absence.
 *
 * Pairs naturally with EmptyState's headline + subtext + cta. Drop
 * this above the headline.
 *
 * Reduced motion: the path renders static. Otherwise the dashed
 * stroke marches forward on a slow 6-second loop.
 */
import { useReducedMotion } from 'motion/react'

export interface EmptyJourneyProps {
  size?: number
}

export default function EmptyJourney({ size = 120 }: EmptyJourneyProps) {
  const reduce = useReducedMotion()

  return (
    <svg
      width={size}
      height={size * 0.8}
      viewBox="0 0 120 96"
      role="presentation"
      aria-hidden
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id="v2-journey-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(106, 207, 137, 0.85)" />
          <stop offset="100%" stopColor="rgba(77, 184, 168, 0.45)" />
        </linearGradient>
      </defs>
      <ellipse cx="14" cy="84" rx="6" ry="2" fill="rgba(0,0,0,0.30)" />
      <path
        d="M 14 80 C 30 60, 28 40, 50 38 C 72 36, 70 60, 90 56 C 108 52, 108 24, 110 14"
        stroke="url(#v2-journey-grad)"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeDasharray="6 6"
      >
        {!reduce && (
          <animate
            attributeName="stroke-dashoffset"
            from="0"
            to="-24"
            dur="6s"
            repeatCount="indefinite"
          />
        )}
      </path>
      <circle cx="14" cy="80" r="4" fill="#6ACF89" stroke="rgba(255,255,255,0.30)" strokeWidth="1" />
      <circle cx="110" cy="14" r="3.5" fill="rgba(77, 184, 168, 0.45)" stroke="rgba(255,255,255,0.30)" strokeWidth="1" />
    </svg>
  )
}
