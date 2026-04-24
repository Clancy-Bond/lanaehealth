/*
 * /v2/cycle/history loading skeleton
 *
 * History is a calendar grid plus a list of completed cycles. Feed
 * variant matches the list-of-rows silhouette closely enough for
 * cold-load coverage.
 */
import { LoadingShell } from '@/v2/components/states'

export default function V2CycleHistoryLoading() {
  return <LoadingShell title="History" variant="feed" />
}
