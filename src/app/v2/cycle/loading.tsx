/*
 * /v2/cycle loading skeleton
 *
 * Cycle page leads with the ring hero, weekday strip, phase tips,
 * and prediction cards. Hero variant matches the ring + tile shape
 * closely enough for cold-load coverage.
 */
import { LoadingShell } from '@/v2/components/states'

export default function V2CycleLoading() {
  return <LoadingShell title="Cycle" variant="hero" />
}
