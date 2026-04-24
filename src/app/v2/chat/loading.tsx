/*
 * /v2/chat loading skeleton
 *
 * Cold-load shell so the user sees the chrome immediately while
 * the client component hydrates and history GET resolves.
 */
import { LoadingShell } from '@/v2/components/states'

export default function V2ChatLoading() {
  return <LoadingShell title="Ask AI" variant="feed" />
}
