'use client'
/*
 * CalorieRingHero
 *
 * MFN-anchored hero. Per CLAUDE.md design philosophy, the calorie
 * surface intentionally clones MyNetDiary's per-section UX language
 * (only the global chrome is Oura). MFN's signature dashboard element
 * is the "calorie apple": a stylized green apple silhouette with a
 * stem-leaf at top, the remaining-calorie number large at center, and
 * a small word ("REMAINING" or "OVER") beneath.
 *
 * We render that apple as inline SVG so it scales crisply, picks up
 * the v2 accent token, and swaps to the warning token when over. The
 * tap-target opens the same CalorieTargetExplainer modal established
 * in PR #45/#46.
 */
import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { AnimatedNumber } from '@/v2/components/primitives'
import { CalorieTargetExplainer } from './MetricExplainers'

export interface CalorieRingHeroProps {
  /** Calories eaten today. */
  eaten: number
  /** Daily calorie target (from nutrition_goals). */
  target: number
}

const APPLE_SIZE = 220

/*
 * MFN's apple is a near-circular body with a small notch at top where
 * the leaf joins. We render the body as a stroked apple-silhouette path,
 * with a separate progress arc that fills clockwise inside the apple
 * outline. Path coords work in a 100x100 viewBox.
 */
function CalorieApple({
  pct,
  fillColor,
  leafColor,
  isEmpty,
}: {
  pct: number
  fillColor: string
  leafColor: string
  isEmpty: boolean
}) {
  const reduce = useReducedMotion()
  const bodyPath =
    'M50 18 ' +
    'C 25 18 12 38 12 58 ' +
    'C 12 80 28 92 50 92 ' +
    'C 72 92 88 80 88 58 ' +
    'C 88 38 75 18 50 18 ' +
    'Z'

  const radius = 38
  const circumference = 2 * Math.PI * radius

  // Arc draws clockwise from 12 o'clock on first paint. Reduced
  // motion: skip the draw and render the final fill immediately.
  const [renderPct, setRenderPct] = useState<number>(reduce ? pct : 0)
  useEffect(() => {
    if (reduce) {
      setRenderPct(pct)
      return
    }
    const id = requestAnimationFrame(() => setRenderPct(pct))
    return () => cancelAnimationFrame(id)
  }, [pct, reduce])
  const offset = circumference * (1 - renderPct / 100)

  return (
    <svg
      width={APPLE_SIZE}
      height={APPLE_SIZE}
      viewBox="0 0 100 100"
      role="presentation"
      aria-hidden
    >
      <path
        d={bodyPath}
        fill="rgba(255,255,255,0.02)"
        stroke="rgba(255,255,255,0.10)"
        strokeWidth="3"
      />
      {!isEmpty && (
        <circle
          cx="50"
          cy="55"
          r={radius}
          fill="none"
          stroke={fillColor}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 50 55)"
          style={{
            transition: reduce
              ? 'none'
              : 'stroke-dashoffset 1.4s var(--v2-ease-emphasized)',
          }}
        />
      )}
      <line
        x1="50"
        y1="14"
        x2="50"
        y2="22"
        stroke={leafColor}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M50 16 C 56 8 66 8 68 12 C 64 18 56 20 50 18 Z"
        fill={leafColor}
      />
    </svg>
  )
}

export default function CalorieRingHero({ eaten, target }: CalorieRingHeroProps) {
  const [open, setOpen] = useState(false)
  const safeTarget = target > 0 ? target : 1
  const overTarget = eaten > safeTarget
  const remaining = Math.max(0, safeTarget - eaten)
  const overage = Math.max(0, eaten - safeTarget)
  const rawPct = Math.max(0, Math.min(100, (eaten / safeTarget) * 100))
  const MIN_VISIBLE_PCT = 4
  const pct = eaten > 0 ? Math.max(MIN_VISIBLE_PCT, rawPct) : 0
  const fillColor = overTarget
    ? 'var(--v2-accent-warning)'
    : 'var(--v2-accent-primary)'
  const leafColor = overTarget
    ? 'var(--v2-accent-warning)'
    : 'var(--v2-accent-primary)'
  const centerLabel = overTarget ? 'OVER' : 'REMAINING'
  const centerNumeric = overTarget ? Math.round(overage) : Math.round(remaining)
  const centerPrefix = overTarget ? '+' : ''
  const isEmpty = eaten === 0

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--v2-space-3)',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={
          isEmpty
            ? `Open calorie target explainer. No calories logged yet. Target ${Math.round(safeTarget)}.`
            : overTarget
              ? `Open calorie target explainer. Over target by ${Math.round(overage)} calories. Eaten ${Math.round(eaten)} of ${Math.round(safeTarget)}.`
              : `Open calorie target explainer. ${Math.round(remaining)} calories remaining. Eaten ${Math.round(eaten)} of ${Math.round(safeTarget)}.`
        }
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          margin: 0,
          cursor: 'pointer',
          color: 'inherit',
          font: 'inherit',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--v2-space-3)',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: APPLE_SIZE,
            height: APPLE_SIZE,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CalorieApple
            pct={pct}
            fillColor={fillColor}
            leafColor={leafColor}
            isEmpty={isEmpty}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span
              style={{
                fontSize: 'var(--v2-text-3xl)',
                fontWeight: 'var(--v2-weight-bold)',
                letterSpacing: 'var(--v2-tracking-tight)',
                color: isEmpty
                  ? 'var(--v2-text-muted)'
                  : 'var(--v2-text-primary)',
                lineHeight: 1,
              }}
            >
              {isEmpty ? (
                centerNumeric
              ) : (
                <AnimatedNumber value={centerNumeric} prefix={centerPrefix} duration={1.5} />
              )}
            </span>
            <span
              style={{
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-text-muted)',
                marginTop: 4,
                letterSpacing: 'var(--v2-tracking-wide)',
                textTransform: 'uppercase',
              }}
            >
              cal
            </span>
            <span
              style={{
                fontSize: 'var(--v2-text-xs)',
                color: overTarget
                  ? 'var(--v2-accent-warning)'
                  : 'var(--v2-text-muted)',
                marginTop: 2,
                letterSpacing: 'var(--v2-tracking-wide)',
                fontWeight: 'var(--v2-weight-semibold)',
              }}
            >
              {centerLabel}
            </span>
          </div>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {Math.round(eaten)} of {Math.round(safeTarget)} cal
        </p>
      </button>

      <CalorieTargetExplainer
        open={open}
        onClose={() => setOpen(false)}
        target={target}
        eaten={eaten}
      />
    </div>
  )
}
