'use client'

/*
 * CycleRingHero
 *
 * NC-fidelity push (PR following #57/58/59): the hero is no longer a
 * generic stroked progress ring. NC's signature visual on frame_0008 is
 * a filled radial-glow ORB with a dotted outer ring, and the dominant
 * text is the binary fertility verdict (Not fertile / Use protection),
 * NOT the cycle day. Cycle day moves to subtitle position next to the
 * date, exactly as NC renders it.
 *
 * Color is keyed to the binary verdict (green orb = not fertile,
 * pink/red orb = fertile / use protection), so the reader's first eye
 * pass answers the actionable question. Cycle day stays tappable for
 * the day explainer; the verdict pill replaces the old phase pill so
 * the explainer chain stays coherent.
 */
import { useState } from 'react'
import type { CyclePhase } from '@/lib/types'
import { CycleDayExplainer, PhaseExplainer } from './MetricExplainers'

const PHASE_LABEL: Record<CyclePhase, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulatory: 'Ovulatory',
  luteal: 'Luteal',
}

type OpenKey = 'day' | 'phase' | null

export type RingVerdict = 'green' | 'red' | 'unknown'

export interface CycleRingHeroProps {
  day: number | null
  phase: CyclePhase | null
  isUnusuallyLong: boolean
  meanCycleLength: number | null
  lastPeriodISO?: string | null
  /**
   * Binary fertility verdict for today, sourced from classifyFertileWindow.
   * The orb color and the dominant headline both key off this.
   */
  verdict?: RingVerdict
  /** Headline text rendered inside the orb (NC: "Not fertile" / "Use protection"). */
  verdictLabel?: string
  /** Tiny temperature pill at the bottom of the orb (NC parity). */
  bbtFahrenheit?: number | null
}

/**
 * NC's orb color stops. Greens for safe day, pinks for fertile day,
 * neutral wash when no verdict is computable yet. Each stack is a
 * radial gradient from a saturated core to a transparent edge so the
 * orb reads as a glowing sphere, not a flat disc.
 */
function orbBackground(verdict: RingVerdict): string {
  if (verdict === 'green') {
    // NC frame_0008: bright fertile-green core, fading to mint, fading
    // to fully transparent. The transparency is what gives the glow.
    return 'radial-gradient(circle at 50% 45%, rgba(106, 207, 137, 0.95) 0%, rgba(106, 207, 137, 0.65) 32%, rgba(77, 184, 168, 0.30) 60%, rgba(77, 184, 168, 0) 90%)'
  }
  if (verdict === 'red') {
    // Mirror palette for "use protection" days; NC's red day uses a warm
    // pink-coral wash with the same falloff curve.
    return 'radial-gradient(circle at 50% 45%, rgba(232, 99, 119, 0.95) 0%, rgba(232, 99, 119, 0.65) 32%, rgba(217, 119, 92, 0.30) 60%, rgba(217, 119, 92, 0) 90%)'
  }
  // Neutral wash when no verdict (e.g., empty state).
  return 'radial-gradient(circle at 50% 45%, rgba(126, 128, 136, 0.40) 0%, rgba(126, 128, 136, 0.20) 50%, rgba(126, 128, 136, 0) 90%)'
}

function dottedRingColor(verdict: RingVerdict): string {
  if (verdict === 'green') return 'rgba(106, 207, 137, 0.55)'
  if (verdict === 'red') return 'rgba(232, 99, 119, 0.55)'
  return 'rgba(126, 128, 136, 0.40)'
}

const ORB_DIAMETER = 240
const DOTTED_RING_OFFSET = 14

export default function CycleRingHero({
  day,
  phase,
  isUnusuallyLong,
  meanCycleLength,
  lastPeriodISO = null,
  verdict = 'unknown',
  verdictLabel,
  bbtFahrenheit = null,
}: CycleRingHeroProps) {
  const [openKey, setOpenKey] = useState<OpenKey>(null)
  const phaseLabel = phase ? PHASE_LABEL[phase] : 'Log a period'
  const dayText = day != null ? `Cycle Day ${day}` : 'No active cycle'
  const headline = verdictLabel ?? (verdict === 'red' ? 'Use protection' : verdict === 'green' ? 'Not fertile' : 'Log to see today')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--v2-space-3)' }}>
      <button
        type="button"
        aria-label={`Cycle day ${day ?? 'unknown'}, ${headline}. Tap for details.`}
        onClick={() => setOpenKey('day')}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          color: 'inherit',
          font: 'inherit',
          position: 'relative',
          width: ORB_DIAMETER + DOTTED_RING_OFFSET * 2,
          height: ORB_DIAMETER + DOTTED_RING_OFFSET * 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Dotted outer ring (NC frame_0008). Pure CSS, no SVG. */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `1.5px dashed ${dottedRingColor(verdict)}`,
            pointerEvents: 'none',
          }}
        />
        {/* Radial-glow orb. */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: DOTTED_RING_OFFSET,
            left: DOTTED_RING_OFFSET,
            width: ORB_DIAMETER,
            height: ORB_DIAMETER,
            borderRadius: '50%',
            background: orbBackground(verdict),
            // A subtle inner highlight at top, like a sphere catching light.
            boxShadow: 'inset 0 -8px 24px rgba(0,0,0,0.10), inset 0 8px 24px rgba(255,255,255,0.06)',
          }}
        />
        {/* Centered content stack: today / day-row / verdict / temp pill. */}
        <span
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            color: 'var(--v2-text-primary)',
            padding: '0 var(--v2-space-4)',
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontSize: 'var(--v2-text-base)',
              color: 'var(--v2-text-secondary)',
              fontWeight: 'var(--v2-weight-medium)',
              letterSpacing: 'var(--v2-tracking-normal)',
            }}
          >
            Today
          </span>
          <span
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {dayText}
          </span>
          <span
            style={{
              fontSize: 'var(--v2-text-2xl)',
              fontWeight: 'var(--v2-weight-bold)',
              letterSpacing: 'var(--v2-tracking-tight)',
              color: 'var(--v2-text-primary)',
              lineHeight: 1.1,
              maxWidth: 200,
            }}
          >
            {headline}
          </span>
          {bbtFahrenheit != null && (
            <span
              style={{
                marginTop: 4,
                padding: '4px 10px',
                borderRadius: 'var(--v2-radius-full)',
                background: 'rgba(0, 0, 0, 0.30)',
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-text-primary)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {bbtFahrenheit.toFixed(2)}°F
            </span>
          )}
        </span>
      </button>

      <button
        type="button"
        aria-label="Open cycle phase explainer"
        onClick={() => setOpenKey('phase')}
        style={{
          background: 'transparent',
          border: '1px solid var(--v2-border-subtle)',
          borderRadius: 'var(--v2-radius-full)',
          padding: 'var(--v2-space-1) var(--v2-space-3)',
          cursor: 'pointer',
          color: 'var(--v2-text-secondary)',
          fontSize: 'var(--v2-text-xs)',
          letterSpacing: 'var(--v2-tracking-wide)',
          textTransform: 'uppercase',
          font: 'inherit',
        }}
      >
        About {phaseLabel.toLowerCase()} phase
      </button>

      {isUnusuallyLong && (
        <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', color: 'var(--v2-accent-warning)', textAlign: 'center', maxWidth: 280, lineHeight: 'var(--v2-leading-normal)' }}>
          Running long. Cycles vary; this is information, not alarm.
        </p>
      )}

      <CycleDayExplainer
        open={openKey === 'day'}
        onClose={() => setOpenKey(null)}
        day={day}
        meanCycleLength={meanCycleLength}
        isUnusuallyLong={isUnusuallyLong}
        lastPeriodISO={lastPeriodISO}
      />
      <PhaseExplainer
        open={openKey === 'phase'}
        onClose={() => setOpenKey(null)}
        phase={phase}
        day={day}
      />
    </div>
  )
}
