/*
 * NutritionClosingCard
 *
 * The final cream-variant card on /v2/topics/nutrition. A gentle
 * reminder that food is one input of many and that patterns emerge
 * over months, not days. Sits on the Natural-Cycles cream surface so
 * the explanatory note reads apart from the dark chrome week strip.
 *
 * Voice follows Natural Cycles: short, kind, informational. Never
 * "you should". No prescription, no optimization language.
 */
import { Card } from '@/v2/components/primitives'

export default function NutritionClosingCard() {
  return (
    <div className="v2-surface-explanatory">
      <Card variant="explanatory" padding="md">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-2)',
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
            One more thing
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-surface-explanatory-text)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            Food is one input among many. Sleep, stress, hydration,
            cycle phase, and medications all shape how you feel. When
            something seems to change things for you, log it. Patterns
            show up over months, not days.
          </p>
        </div>
      </Card>
    </div>
  )
}
