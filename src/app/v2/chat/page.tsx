/**
 * /v2/chat: AI chat surface
 *
 * The mobile-first entry point for the Three-Layer Context Engine.
 * The legacy /chat surface is the reference; this page reuses the
 * same /api/chat backend (which already wires permanent core, smart
 * summaries, and pgvector retrieval).
 *
 * Server component shell: renders MobileShell chrome + the client
 * conversation view. History is loaded inside ChatClient on mount
 * via /api/chat/history so cold-start does not block on it here.
 */
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import ChatClient from './_components/ChatClient'

export const dynamic = 'force-dynamic'

export default function V2ChatPage() {
  return (
    <MobileShell
      top={<TopAppBar variant="standard" title="Ask AI" />}
      scroll={false}
    >
      <ChatClient />
    </MobileShell>
  )
}
