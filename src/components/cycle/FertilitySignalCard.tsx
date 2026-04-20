/**
 * Current fertility signal card. Mirrors NC's fertile window framing
 * WITHOUT the contraceptive Red/Green day coloring. We use the warm-modern
 * palette (sage, blush, amber) and always include a confidence caveat.
 *
 * Voice: never "safe day", never "lucky day". Factual + neutral.
 */
import type { FertileWindowPrediction } from '@/lib/cycle/period-prediction'
import { Flower2, Sparkles, Leaf } from 'lucide-react'

export interface FertilitySignalCardProps {
  prediction: FertileWindowPrediction
  /** Whether BBT detector has confirmed a sustained shift in the last 14 days. */
  confirmedOvulation: boolean
  /** Compact form for home widget. */
  size?: 'hero' | 'widget'
}

const STATUS_STYLE: Record<FertileWindowPrediction['status'], { tone: string; accent: string; bg: string; iconBg: string }> = {
  unknown: {
    tone: 'Cycle unknown',
    accent: 'var(--text-muted)',
    bg: 'var(--bg-elevated)',
    iconBg: 'var(--border-light)',
  },
  out_window: {
    tone: 'Outside fertile window',
    accent: 'var(--accent-sage)',
    bg: 'var(--accent-sage-muted)',
    iconBg: 'var(--accent-sage-light)',
  },
  in_window: {
    tone: 'In fertile window',
    accent: 'var(--accent-blush)',
    bg: 'var(--accent-blush-muted)',
    iconBg: 'var(--accent-blush-light)',
  },
  post_ovulation: {
    tone: 'Post-ovulation',
    accent: 'var(--phase-luteal)',
    bg: 'rgba(232, 168, 73, 0.12)',
    iconBg: 'rgba(232, 168, 73, 0.25)',
  },
}

export function FertilitySignalCard({
  prediction,
  confirmedOvulation,
  size = 'hero',
}: FertilitySignalCardProps) {
  const style = STATUS_STYLE[prediction.status]
  const Icon = prediction.status === 'in_window' ? Sparkles : prediction.status === 'post_ovulation' ? Leaf : Flower2

  const headline = (() => {
    if (prediction.status === 'unknown') return 'Fertile window needs more history'
    if (prediction.status === 'in_window') {
      if (prediction.daysUntilCloses != null && prediction.daysUntilCloses > 0) {
        return `Estimated fertile window for ~${prediction.daysUntilCloses + 1} more day${prediction.daysUntilCloses === 0 ? '' : 's'}`
      }
      return 'In estimated fertile window'
    }
    if (prediction.status === 'out_window') {
      return prediction.daysUntilWindow != null && prediction.daysUntilWindow > 0
        ? `Fertile window opens in ~${prediction.daysUntilWindow} day${prediction.daysUntilWindow === 1 ? '' : 's'}`
        : 'Outside estimated fertile window'
    }
    return confirmedOvulation ? 'Ovulation confirmed by BBT shift' : 'Estimated ovulation has passed'
  })()

  return (
    <div
      className="card"
      style={{
        padding: size === 'hero' ? '18px 20px' : '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        background: style.bg,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          aria-hidden
          style={{
            width: size === 'hero' ? 40 : 32,
            height: size === 'hero' ? 40 : 32,
            borderRadius: '50%',
            background: style.iconBg,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={size === 'hero' ? 20 : 16} style={{ color: style.accent }} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: style.accent,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Fertility today
          </div>
          <div
            style={{
              fontSize: size === 'hero' ? 17 : 14,
              fontWeight: 700,
              color: 'var(--text-primary)',
              lineHeight: 1.2,
              marginTop: 2,
            }}
          >
            {style.tone}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
        {headline}
      </div>

      {prediction.rangeStart && prediction.rangeEnd && (
        <div
          className="tabular"
          style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
          }}
        >
          Window estimate: {prediction.rangeStart} to {prediction.rangeEnd}
        </div>
      )}

      <p style={{ fontSize: 12, margin: 0, color: 'var(--text-muted)', lineHeight: 1.4 }}>
        {prediction.caveat}
      </p>

      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          alignSelf: 'flex-start',
          padding: '3px 8px',
          borderRadius: 999,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: style.accent,
          background: 'var(--bg-card)',
        }}
      >
        Confidence: {prediction.confidence}
      </div>
    </div>
  )
}
