'use client'

/**
 * InsightConfidenceExplainer
 *
 * Tap-to-explain modal for any narrated correlation card. Patterns
 * carry a lot of statistical context that does not fit in a card
 * subtitle: what does r mean, how was the tier assigned, why is the
 * row labeled stale. This modal is the canonical place that copy
 * lives so InsightCardList stays a glance-read.
 *
 * Structure mirrors the home metric explainers (PR #45 / #46):
 * paragraph form, source attribution, NC voice, no causal language.
 */
import ExplainerSheet from '../../../_components/ExplainerSheet'
import type { InsightNarration } from '@/lib/intelligence/insight-narrator'

export interface InsightConfidenceExplainerProps {
  open: boolean
  onClose: () => void
  /** The narrated correlation row that triggered the modal. */
  narration: InsightNarration
}

function tierCopy(tier: InsightNarration['confidenceTier']): { label: string; body: string } {
  switch (tier) {
    case 'strong':
      return {
        label: 'Strong',
        body:
          'A strong tier means the relationship has held up across enough days that random noise is an unlikely explanation. It still does not mean one factor causes the other.',
      }
    case 'moderate':
      return {
        label: 'Moderate',
        body:
          'A moderate tier means the relationship is real enough to watch but not strong enough to act on alone. Pair it with how you actually feel before changing anything.',
      }
    case 'suggestive':
      return {
        label: 'Suggestive',
        body:
          'A suggestive tier means the early shape is there but the sample is still small. Treat it as a hypothesis, not a finding. It will firm up or fade as more days come in.',
      }
  }
}

export default function InsightConfidenceExplainer({
  open,
  onClose,
  narration,
}: InsightConfidenceExplainerProps) {
  const tier = tierCopy(narration.confidenceTier)
  const sourceParts: string[] = []
  if (narration.rValueLabel) sourceParts.push(narration.rValueLabel)
  sourceParts.push(`tier: ${tier.label}`)
  sourceParts.push(narration.freshnessLabel)
  const sourceNote = sourceParts.join(' . ')

  return (
    <ExplainerSheet
      open={open}
      onClose={onClose}
      title="What this pattern means"
      source={sourceNote}
    >
      <p style={{ margin: 0 }}>
        Patterns here come from a daily statistics pass over your logged data.
        The narrator picks the most informative ones, gives each a strength
        score, and rewrites it as a single sentence you can read at a glance.
      </p>
      <p style={{ margin: 0 }}>
        <strong>{tier.label} confidence.</strong> {tier.body}
      </p>
      {narration.rValueLabel && (
        <p style={{ margin: 0 }}>
          <strong>{narration.rValueLabel}.</strong> The number after the equals
          sign is the strength of the link. Closer to 1 (or -1) means a tighter
          fit; closer to 0 means looser. A negative sign means the two move in
          opposite directions, not that one is bad.
        </p>
      )}
      <p style={{ margin: 0 }}>
        <strong>Freshness.</strong> Each row carries the date its math was
        computed. Anything older than 30 days gets a muted warning so you can
        tell at a glance whether this is current life or last season.
      </p>
      <p style={{ margin: 0 }}>
        Patterns are associations, not causes. They are good for noticing and
        bad for prescribing. Use them to ask better questions of your body
        and your doctor.
      </p>
    </ExplainerSheet>
  )
}
