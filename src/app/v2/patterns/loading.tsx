/*
 * /v2/patterns loading skeleton
 *
 * Patterns hub renders an explainer card, a list of insight cards,
 * and a 2x2 entry grid. Feed variant matches that shape.
 */
import { LoadingShell } from '@/v2/components/states'

export default function V2PatternsLoading() {
  return <LoadingShell title="Patterns" variant="feed" />
}
