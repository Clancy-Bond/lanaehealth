/*
 * /v2/cycle/log loading skeleton
 *
 * The log form is a long stack of grouped fields (flow, ovulation,
 * cervical mucus, symptoms, mood). Feed variant matches the vertical
 * list silhouette better than the ring-centered hero variant.
 */
import { LoadingShell } from '@/v2/components/states'

export default function V2CycleLogLoading() {
  return <LoadingShell title="Log cycle" variant="feed" />
}
