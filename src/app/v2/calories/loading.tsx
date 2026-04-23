/*
 * /v2/calories loading skeleton
 *
 * Calories page leads with the date strip and ring hero, macro
 * tiles, and meal sections. Hero variant matches the ring + tile
 * shape closely enough for cold-load coverage.
 */
import { LoadingShell } from '@/v2/components/states'

export default function V2CaloriesLoading() {
  return <LoadingShell title="Calories" variant="hero" />
}
