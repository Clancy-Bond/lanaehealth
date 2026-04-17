/**
 * Chat History API Route
 *
 * GET  /api/chat/history
 *   Load last 100 messages.
 *
 * DELETE /api/chat/history
 *   Destructive. Guarded per QA Session 2 W2.4.
 *     ?confirm=archive
 *         Copy all rows from chat_messages into chat_messages_archive
 *         (insert-select), then delete from chat_messages. Requires the
 *         archive table to exist (Wave 3 migration).
 *     ?confirm=hard&token=<CHAT_HARD_DELETE_TOKEN>
 *         Hard delete without archive. Requires the env secret to match.
 *     (no params)
 *         Returns 400 with guidance -- the legacy wipe-everything semantic
 *         is no longer allowed.
 *
 * chat_messages feeds compaction, handoff, and the 3-layer context engine,
 * so a single unauthenticated wipe would destroy months of conversation
 * data. See docs/qa/2026-04-16-chat-history-delete-wipes-all.md.
 */

import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
const DOCS_URL = 'docs/qa/2026-04-16-chat-history-delete-wipes-all.md'

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

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url)
    const confirm = url.searchParams.get('confirm')
    const token = url.searchParams.get('token')

    if (!confirm) {
      return Response.json(
        {
          error:
            'destructive operation requires ?confirm=archive or ?confirm=hard',
          docs: DOCS_URL,
        },
        { status: 400 },
      )
    }

    if (confirm === 'archive') {
      return await archiveAndDelete()
    }

    if (confirm === 'hard') {
      return await hardDelete(token)
    }

    return Response.json(
      {
        error: `unknown confirm value: ${confirm}. expected 'archive' or 'hard'`,
        docs: DOCS_URL,
      },
      { status: 400 },
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ error: message }, { status: 500 })
  }
}

/**
 * Archive path: select all rows from chat_messages, insert into
 * chat_messages_archive, then delete from chat_messages. If the archive
 * table does not exist (Wave 3 migration not yet applied), fail with 501
 * and a clear message.
 */
async function archiveAndDelete(): Promise<Response> {
  const supabase = createServiceClient()

  // Pull every row we are about to archive. Column list must match the
  // archive table schema (assumed identical to chat_messages).
  const { data: rows, error: selectError } = await supabase
    .from('chat_messages')
    .select('*')

  if (selectError) {
    return Response.json(
      { error: `failed to read chat_messages: ${selectError.message}` },
      { status: 500 },
    )
  }

  const rowCount = rows?.length ?? 0

  if (rowCount === 0) {
    return Response.json({
      success: true,
      archived: 0,
      deleted: 0,
      message: 'chat_messages was already empty',
    })
  }

  // Insert into archive. If the table is missing, Supabase returns an
  // error whose message mentions the relation. Catch that and report 501.
  const { error: insertError } = await supabase
    .from('chat_messages_archive')
    .insert(rows)

  if (insertError) {
    const missingTable = isMissingRelationError(
      insertError,
      'chat_messages_archive',
    )
    if (missingTable) {
      return Response.json(
        {
          error:
            'chat_messages_archive table does not exist. Apply the Wave 3 migration before running archive delete.',
          details: insertError.message,
          docs: DOCS_URL,
        },
        { status: 501 },
      )
    }
    return Response.json(
      { error: `failed to archive chat_messages: ${insertError.message}` },
      { status: 500 },
    )
  }

  // Only delete after the archive insert succeeded.
  const { error: deleteError } = await supabase
    .from('chat_messages')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (deleteError) {
    return Response.json(
      {
        error: `archive succeeded but delete failed: ${deleteError.message}. chat_messages_archive now holds a duplicate copy.`,
      },
      { status: 500 },
    )
  }

  return Response.json({
    success: true,
    archived: rowCount,
    deleted: rowCount,
  })
}

/**
 * Hard delete path: wipe chat_messages without archive. Requires the
 * CHAT_HARD_DELETE_TOKEN env var and a matching ?token= query param.
 */
async function hardDelete(token: string | null): Promise<Response> {
  const expected = process.env.CHAT_HARD_DELETE_TOKEN

  if (!expected) {
    return Response.json(
      {
        error:
          'CHAT_HARD_DELETE_TOKEN is not configured on the server; hard delete is disabled',
        docs: DOCS_URL,
      },
      { status: 401 },
    )
  }

  if (!token || token !== expected) {
    return Response.json(
      {
        error: 'hard delete requires a matching ?token= query parameter',
        docs: DOCS_URL,
      },
      { status: 401 },
    )
  }

  const supabase = createServiceClient()

  const { error } = await supabase
    .from('chat_messages')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true, mode: 'hard' })
}

/**
 * Supabase/Postgres surfaces a missing table as an error whose code is
 * 42P01 (undefined_table) or whose message mentions the relation name.
 * We check both to stay robust across driver versions.
 */
function isMissingRelationError(
  error: { code?: string; message?: string } | null | undefined,
  relation: string,
): boolean {
  if (!error) return false
  if (error.code === '42P01') return true
  const msg = (error.message || '').toLowerCase()
  return (
    msg.includes(`relation "${relation}"`) ||
    msg.includes(`relation "public.${relation}"`) ||
    (msg.includes(relation) && msg.includes('does not exist'))
  )
}
