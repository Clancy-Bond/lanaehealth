/**
 * PainCheckInCard
 *
 * Surfaces a one-tap link to /v2/log/pain when:
 *   - the user has not logged pain today, AND
 *   - their active diagnoses include migraine or POTS-like conditions
 *     (chronic pain populations where daily logging meaningfully
 *     improves the doctor visit).
 *
 * Phrasing follows the non-shaming voice rule (no "you should",
 * no streak shaming). The card is invisible if either condition
 * fails, so the Today page stays calm for users without chronic
 * pain.
 */
import Link from 'next/link'
import { Card } from '@/v2/components/primitives'

export interface PainCheckInCardProps {
  /** True when daily_logs.overall_pain is null for today. */
  showCard: boolean
  /** True when user has migraine or POTS-like diagnoses on file. */
  isChronicPainPatient: boolean
}

export default function PainCheckInCard({ showCard, isChronicPainPatient }: PainCheckInCardProps) {
  if (!showCard || !isChronicPainPatient) return null
  return (
    <Card padding="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-1)' }}>
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--v2-tracking-wide)',
              fontWeight: 'var(--v2-weight-medium)',
            }}
          >
            Pain check-in
          </span>
          <h3
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-base)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
            }}
          >
            How does today feel in the body?
          </h3>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-secondary)',
            lineHeight: 'var(--v2-leading-relaxed)',
          }}
        >
          A quick number now is more useful to your doctor than a perfect rating you write in three days.
        </p>
        <Link
          href="/v2/log/pain"
          style={{
            alignSelf: 'flex-start',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px 18px',
            borderRadius: 'var(--v2-radius-pill)',
            background: 'var(--v2-accent-primary)',
            color: 'var(--v2-bg-base)',
            fontSize: 'var(--v2-text-sm)',
            fontWeight: 'var(--v2-weight-semibold)',
            textDecoration: 'none',
            minHeight: 'var(--v2-touch-target-min)',
          }}
        >
          Open pain log
        </Link>
      </div>
    </Card>
  )
}
