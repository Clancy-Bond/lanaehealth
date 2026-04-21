// TODO(lanae): review and edit mechanism/helps/watch copy per condition.
// These are conservative placeholder strings; the final copy should
// reflect your doctors' guidance and your own pattern observations.
/*
 * ConditionFoodCard
 *
 * Cream-variant explanatory card that pairs a condition name with a
 * mechanism paragraph and two short lists: foods that often help and
 * foods that sometimes worsen symptoms. Consumes placeholder content
 * for the initial ship; Lanae and the reviewer will refine.
 *
 * Voice follows Natural Cycles. Never "you should". Phrased as
 * "often helps" / "sometimes worsens" so the card reads as reference,
 * not prescription. Lists are capped at 3 items to keep the card
 * scannable on a phone.
 */
import { Card } from '@/v2/components/primitives'

export interface ConditionFoodCardProps {
  condition: string
  mechanism: string
  helps: string[]
  watch: string[]
}

export default function ConditionFoodCard({
  condition,
  mechanism,
  helps,
  watch,
}: ConditionFoodCardProps) {
  const helpsCapped = helps.slice(0, 3)
  const watchCapped = watch.slice(0, 3)

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
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-surface-explanatory-muted)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--v2-tracking-wide)',
            }}
          >
            {condition}
          </span>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-surface-explanatory-text)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            {mechanism}
          </p>
          <ConditionList
            heading="Foods that often help"
            items={helpsCapped}
          />
          <ConditionList
            heading="Foods that sometimes worsen symptoms"
            items={watchCapped}
          />
        </div>
      </Card>
    </div>
  )
}

function ConditionList({
  heading,
  items,
}: {
  heading: string
  items: string[]
}) {
  if (items.length === 0) return null
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-1)',
      }}
    >
      <span
        style={{
          fontSize: 'var(--v2-text-xs)',
          fontWeight: 'var(--v2-weight-semibold)',
          color: 'var(--v2-surface-explanatory-muted)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--v2-tracking-wide)',
        }}
      >
        {heading}
      </span>
      <ul
        style={{
          margin: 0,
          paddingLeft: 'var(--v2-space-5)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-1)',
        }}
      >
        {items.map((item) => (
          <li
            key={item}
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-surface-explanatory-text)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
