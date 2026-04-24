/**
 * TodayHero
 *
 * Large date header + progress sentence. Frames the rest of the
 * page as "today in context" rather than a static dashboard.
 *
 * Chrome: matches home's PrimaryInsightCard gradient pattern (PR #42)
 * so the Today page opens with the same brand-anchored moment instead
 * of a flat date row. Subtle teal/violet wash over --v2-bg-card.
 */
import DateHeader from '../../_components/DateHeader'

export interface TodayHeroProps {
  iso: string
  hour: number
  loggedCount: number
  totalCount: number
}

export default function TodayHero({ iso, hour, loggedCount, totalCount }: TodayHeroProps) {
  const subtext =
    loggedCount === 0
      ? 'No check-ins yet today. Logging one helps tomorrow read clearer.'
      : loggedCount >= totalCount
        ? 'Everything you needed to log today is in. Nicely done.'
        : `${loggedCount} of ${totalCount} check-ins in. Keep going if you feel up to it.`
  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 'var(--v2-radius-lg)',
        border: '1px solid var(--v2-border-subtle)',
        padding: 'var(--v2-space-5)',
        overflow: 'hidden',
        background:
          'linear-gradient(135deg, rgba(77, 184, 168, 0.14) 0%, rgba(155, 127, 224, 0.06) 55%, rgba(23, 23, 27, 0) 100%), var(--v2-bg-card)',
      }}
    >
      <DateHeader iso={iso} hour={hour} subtext={subtext} />
    </div>
  )
}
