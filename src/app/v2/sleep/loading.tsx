/*
 * /v2/sleep loading skeleton
 *
 * Sleep page leads with a large ring + four contributor tiles, then
 * a trend chart and night list. Hero variant matches that shape.
 */
import { LoadingShell } from '@/v2/components/states'

export default function V2SleepLoading() {
  return <LoadingShell title="Sleep" variant="hero" />
}
