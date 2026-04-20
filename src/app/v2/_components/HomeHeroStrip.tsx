/**
 * HomeHeroStrip
 *
 * Greeting row at the top of home. Renders under the large TopAppBar
 * and above the primary insight card. Sets the emotional tone of the
 * day: first thing the reader sees is a kind salutation rooted in a
 * date, not a number.
 */
import DateHeader from './DateHeader'

export interface HomeHeroStripProps {
  iso: string
  hour: number
  loggedCount: number
  totalCount: number
}

export default function HomeHeroStrip({ iso, hour, loggedCount, totalCount }: HomeHeroStripProps) {
  const subtext =
    totalCount === 0
      ? 'Taking it slow today is fine too.'
      : loggedCount === 0
        ? 'A quick check-in helps tomorrow read clearer.'
        : loggedCount === totalCount
          ? 'Everything you needed to log today is in.'
          : `${loggedCount} of ${totalCount} check-ins logged.`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
      <DateHeader iso={iso} hour={hour} subtext={subtext} />
    </div>
  )
}
