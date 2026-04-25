'use client'

/*
 * OnboardingHero
 *
 * Welcome graphic for first-time users. Sits at the top of the v2
 * signup / login surface (or any future onboarding surface) and
 * reads as a short visual greeting before the form. A soft sun rises
 * behind a hand-drawn arc; a pair of small petals float up and to
 * the right on a 6-second loop.
 *
 * Reduced motion: graphic renders static, no float.
 */
import { useReducedMotion } from 'motion/react'

export interface OnboardingHeroProps {
  size?: number
}

export default function OnboardingHero({ size = 200 }: OnboardingHeroProps) {
  const reduce = useReducedMotion()
  return (
    <svg
      width={size}
      height={size * 0.75}
      viewBox="0 0 200 150"
      role="presentation"
      aria-hidden
      style={{ display: 'block' }}
    >
      <defs>
        <radialGradient id="v2-onboarding-sun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F0C97A" />
          <stop offset="100%" stopColor="#F0955A" />
        </radialGradient>
        <radialGradient id="v2-onboarding-glow" cx="50%" cy="60%" r="60%">
          <stop offset="0%" stopColor="rgba(240, 201, 122, 0.50)" />
          <stop offset="100%" stopColor="rgba(240, 201, 122, 0)" />
        </radialGradient>
        <linearGradient id="v2-onboarding-arc" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(77, 184, 168, 0.85)" />
          <stop offset="100%" stopColor="rgba(106, 207, 137, 0.85)" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="200" height="150" fill="url(#v2-onboarding-glow)" />
      <ellipse cx="100" cy="155" rx="60" ry="6" fill="rgba(0,0,0,0.18)" />
      <circle cx="100" cy="100" r="36" fill="url(#v2-onboarding-sun)" />
      <path
        d="M 28 120 Q 60 60, 100 64 T 172 120"
        stroke="url(#v2-onboarding-arc)"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      {/* Floating petals */}
      <g className={reduce ? '' : 'v2-float-loop'}>
        <ellipse cx="146" cy="48" rx="6" ry="4" fill="rgba(106, 207, 137, 0.85)" transform="rotate(-25 146 48)" />
      </g>
      <g className={reduce ? '' : 'v2-float-loop'} style={{ animationDelay: '1.4s' }}>
        <ellipse cx="160" cy="36" rx="4" ry="3" fill="rgba(240, 149, 90, 0.85)" transform="rotate(20 160 36)" />
      </g>
    </svg>
  )
}
