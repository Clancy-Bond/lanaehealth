/*
 * /v2/cycle/log loading skeleton
 *
 * The log form is a long stack of grouped fields (flow, ovulation,
 * cervical mucus, symptoms, mood). Feed variant matches the vertical
 * list silhouette better than the ring-centered hero variant. Wrapped
 * in CycleSurface for NC cream chrome consistency.
 */
import { LoadingShell } from '@/v2/components/states'
import CycleSurface from '../_components/CycleSurface'

export default function V2CycleLogLoading() {
  return (
    <CycleSurface>
      <LoadingShell title="Log cycle" variant="feed" />
    </CycleSurface>
  )
}
