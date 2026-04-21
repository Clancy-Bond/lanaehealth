/*
 * NutritionIntroCard
 *
 * Short framing card at the top of /v2/topics/nutrition. Dark chrome
 * (default variant) so it sits visually with the week strip above the
 * cream condition cards below. Voice follows Natural Cycles: short,
 * kind, informational. Never "you should". Food is framed as context
 * for patterns, not as a diet plan.
 */
import { Card } from '@/v2/components/primitives'

export default function NutritionIntroCard() {
  return (
    <Card padding="md">
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
            color: 'var(--v2-text-primary)',
          }}
        >
          Food is context
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-secondary)',
            lineHeight: 'var(--v2-leading-relaxed)',
          }}
        >
          This page collects what is known about food and three conditions
          you track. It is not a diet. Read what fits you.
        </p>
      </div>
    </Card>
  )
}
