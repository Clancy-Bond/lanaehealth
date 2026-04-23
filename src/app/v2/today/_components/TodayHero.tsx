/**
 * TodayHero
 *
 * Large date header + progress sentence. Frames the rest of the
 * page as "today in context" rather than a static dashboard.
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
  return <DateHeader iso={iso} hour={hour} subtext={subtext} />
}
