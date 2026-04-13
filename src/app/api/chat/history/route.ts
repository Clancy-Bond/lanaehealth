/**
 * Chat History API Route
 *
 * GET  /api/chat/history  - Load last 100 messages
 * DELETE /api/chat/history - Clear all chat history
 */

import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, role, content, tools_used, created_at')
      .order('created_at', { ascending: true })
      .limit(100)

    if (error) throw error

    return Response.json({ messages: data || [] })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const supabase = createServiceClient()

    // Delete all chat messages
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // delete all rows (Supabase requires a filter)

    if (error) throw error

    return Response.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ error: message }, { status: 500 })
  }
}
