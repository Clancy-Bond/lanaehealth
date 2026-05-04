/*
 * /v2/cycle loading skeleton
 *
 * Cycle page leads with the ring hero, weekday strip, phase tips,
 * and prediction cards. Hero variant matches the ring + tile shape
 * closely enough for cold-load coverage. Wrapped in CycleSurface so
 * the loading state shows the same NC cream chrome as page.tsx; without
 * the wrapper the dark `--v2-bg-sky` gradient bleeds through and the
 * skeleton flashes dark before page.tsx mounts cream.
 */
import { LoadingShell } from '@/v2/components/states'
import CycleSurface from './_components/CycleSurface'

export default function V2CycleLoading() {
  return (
    <CycleSurface>
      <LoadingShell title="Cycle" variant="hero" />
    </CycleSurface>
  )
}
