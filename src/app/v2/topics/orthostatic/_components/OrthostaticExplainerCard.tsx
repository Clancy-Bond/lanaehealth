/*
 * OrthostaticExplainerCard
 *
 * Plain-English read of the numbers. Rendered on the NC cream surface
 * via Card variant="explanatory" so the educational block sits visually
 * apart from the dark chrome above and frame_0080.png reads as the
 * reference.
 *
 * Voice follows Natural Cycles: short, kind, informational. Never "you
 * should". This is a reading surface, not a nudge.
 */
import { Card } from '@/v2/components/primitives'

export default function OrthostaticExplainerCard() {
  return (
    <div className="v2-surface-explanatory">
      <Card variant="explanatory" padding="md">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-3)',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-lg)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-surface-explanatory-text)',
            }}
          >
            How to read these numbers
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-surface-explanatory-text)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            Peak rise is how much your heart rate climbs from lying down to
            standing up. Most people stay within 20 beats per minute; POTS is
            documented when the rise reaches 30 or more, sustained.
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-surface-explanatory-text)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            Borderline is between 20 and 30. Hydration, caffeine, and sleep
            all shift numbers between visits.
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-surface-explanatory-text)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            One high reading is not a diagnosis. Clinicians look for 3
            positives at least 14 days apart before documenting POTS.
          </p>
        </div>
      </Card>
    </div>
  )
}
