/*
 * CaloriesReadinessBanner
 *
 * Gentle Oura context above the dashboard. Surfaces today's
 * readiness score (and optionally sleep) so Lanae sees how her
 * body is trending before planning intake. Renders nothing when no
 * readiness_score is available for this date, because silence is
 * better than faking a number. Voice: facts + a kind nudge, never
 * prescription.
 *
 * Ported from legacy `src/components/calories/ReadinessBanner.tsx`
 * and retuned for v2's Banner primitive.
 */
import { Banner } from '@/v2/components/primitives'

export interface CaloriesReadinessBannerProps {
  readinessScore: number | null
  sleepScore: number | null
  isToday: boolean
}

export default function CaloriesReadinessBanner({
  readinessScore,
  sleepScore,
  isToday,
}: CaloriesReadinessBannerProps) {
  if (readinessScore == null) return null

  const band = readinessBand(readinessScore)
  const title =
    band === 'high'
      ? 'Reserves look steady'
      : band === 'mid'
        ? 'Running on a typical day'
        : 'Lower reserve today'

  const sleepSuffix = sleepScore != null ? `Sleep ${sleepScore}. ` : ''
  const body =
    band === 'high'
      ? `${sleepSuffix}Eat on your usual rhythm.`
      : band === 'mid'
        ? `${sleepSuffix}Balanced meals tend to help.`
        : `${sleepSuffix}Hydration and a little extra protein can ease the day.`

  const contextLabel = isToday ? "Today's body" : "That day's body"

  return (
    <Banner
      intent="info"
      title={
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--v2-space-2)',
            flexWrap: 'wrap',
          }}
        >
          <span
            aria-hidden
            style={{
              fontSize: 'var(--v2-text-xs)',
              letterSpacing: 'var(--v2-tracking-wide)',
              textTransform: 'uppercase',
              color: 'var(--v2-text-muted)',
            }}
          >
            {contextLabel}
          </span>
          <span>{title}</span>
        </span>
      }
      body={body}
      trailing={
        <div
          aria-label={`Readiness score ${readinessScore}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 44,
            minHeight: 44,
            padding: 'var(--v2-space-1) var(--v2-space-2)',
            borderRadius: 'var(--v2-radius-md)',
            background: 'var(--v2-accent-primary-soft)',
            color: 'var(--v2-accent-primary)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span
            style={{
              fontSize: 'var(--v2-text-lg)',
              fontWeight: 'var(--v2-weight-bold)',
              lineHeight: 1,
            }}
          >
            {readinessScore}
          </span>
          <span
            style={{
              fontSize: 9,
              textTransform: 'uppercase',
              letterSpacing: 'var(--v2-tracking-wide)',
              marginTop: 2,
            }}
          >
            ready
          </span>
        </div>
      }
    />
  )
}

function readinessBand(score: number): 'high' | 'mid' | 'low' {
  if (score >= 80) return 'high'
  if (score >= 65) return 'mid'
  return 'low'
}
