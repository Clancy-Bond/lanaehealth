/*
 * /v2/today loading skeleton
 *
 * Today page leads with a hero ("3 of 4 logged"), then progress
 * rings, cycle phase card, and remaining tasks list. Hero variant
 * matches that shape.
 */
import { LoadingShell } from '@/v2/components/states'

export default function V2TodayLoading() {
  return <LoadingShell title="Today" variant="hero" />
}
