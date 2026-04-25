/**
 * Persistence layer for cycle messages.
 *
 * Backed by the `cycle_messages` table (migration 039). Each row is
 * scoped to user_id and idempotent on (user_id, dedupe_key) so the
 * generator can be invoked multiple times per day without piling up
 * duplicates.
 *
 * All mutations go through service-role; read paths filter by user_id.
 */
import { createServiceClient } from '@/lib/supabase'
import type { CycleMessage, MessageKind } from './messages'

export interface StoredMessage {
  id: string
  user_id: string
  kind: MessageKind
  title: string
  body: string
  dedupe_key: string
  dismissed: boolean
  created_at: string
}

/**
 * Insert messages idempotently. ON CONFLICT (user_id, dedupe_key) DO
 * NOTHING. Returns the count of newly inserted rows.
 */
export async function persistMessages(
  userId: string,
  messages: ReadonlyArray<CycleMessage>,
): Promise<number> {
  if (!userId || messages.length === 0) return 0
  const sb = createServiceClient()
  const rows = messages.map((m) => ({
    user_id: userId,
    kind: m.kind,
    title: m.title,
    body: m.body,
    dedupe_key: m.dedupeKey,
    dismissed: false,
    created_at: m.createdAt,
  }))
  try {
    const { data, error } = await sb
      .from('cycle_messages')
      .upsert(rows, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true })
      .select('id')
    if (error) return 0
    return data?.length ?? 0
  } catch {
    return 0
  }
}

/**
 * List the user's messages, newest first. Optionally filter to undismissed.
 */
export async function listMessages(
  userId: string,
  options: { onlyUndismissed?: boolean; limit?: number } = {},
): Promise<StoredMessage[]> {
  if (!userId) return []
  try {
    const sb = createServiceClient()
    let q = sb
      .from('cycle_messages')
      .select('id, user_id, kind, title, body, dedupe_key, dismissed, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(options.limit ?? 50)
    if (options.onlyUndismissed) q = q.eq('dismissed', false)
    const { data, error } = await q
    if (error || !data) return []
    return data as StoredMessage[]
  } catch {
    return []
  }
}

/**
 * Count undismissed messages for the bottom-tab bell badge.
 */
export async function countUnreadMessages(userId: string): Promise<number> {
  if (!userId) return 0
  try {
    const sb = createServiceClient()
    const { count, error } = await sb
      .from('cycle_messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('dismissed', false)
    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}

/**
 * Mark one message as dismissed. Returns true on success.
 */
export async function dismissMessage(userId: string, messageId: string): Promise<boolean> {
  if (!userId || !messageId) return false
  try {
    const sb = createServiceClient()
    const { error } = await sb
      .from('cycle_messages')
      .update({ dismissed: true })
      .eq('user_id', userId)
      .eq('id', messageId)
    return !error
  } catch {
    return false
  }
}

/**
 * Read the last cycle_insight_ready sampleSize so the generator only
 * emits a fresh insight message when the count has advanced. Stored
 * inline on the dedupe_key (`insight_ready:{n}`).
 */
export async function lastInsightSampleSize(userId: string): Promise<number> {
  if (!userId) return 0
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('cycle_messages')
      .select('dedupe_key')
      .eq('user_id', userId)
      .eq('kind', 'cycle_insight_ready')
      .order('created_at', { ascending: false })
      .limit(1)
    if (error || !data || data.length === 0) return 0
    const key = (data[0] as { dedupe_key: string }).dedupe_key
    const m = key.match(/^insight_ready:(\d+)$/)
    return m ? parseInt(m[1], 10) : 0
  } catch {
    return 0
  }
}
