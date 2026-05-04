/*
 * /v2/cycle/history loading skeleton
 *
 * History is a calendar grid plus a list of completed cycles. Feed
 * variant matches the list-of-rows silhouette closely enough for
 * cold-load coverage. Wrapped in CycleSurface so the loading state
 * shows the same NC cream chrome as page.tsx (see CycleSurface for
 * the --v2-bg-sky override rationale).
 */
import { LoadingShell } from '@/v2/components/states'
import CycleSurface from '../_components/CycleSurface'

export default function V2CycleHistoryLoading() {
  return (
    <CycleSurface>
      <LoadingShell title="History" variant="feed" />
    </CycleSurface>
  )
}
