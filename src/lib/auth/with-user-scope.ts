/**
 * User-scoped server access helpers for PHI route handlers. See migration 038.
 */
import { NextResponse } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { getCurrentUser } from './get-user'
import { createServiceClient } from '@/lib/supabase'

export interface UserScopeOk { ok: true; user: User; supabase: SupabaseClient }
export interface UserScopeFail { ok: false; response: Response }
export type UserScope = UserScopeOk | UserScopeFail

export async function requireUserScope(): Promise<UserScope> {
  const user = await getCurrentUser()
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }) }
  }
  return { ok: true, user, supabase: createServiceClient() }
}

export function insertForUser<TRow extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  row: TRow,
  userId: string,
) {
  return supabase.from(table).insert({ ...row, user_id: userId })
}

export function upsertForUser<TRow extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  row: TRow,
  userId: string,
  options?: { onConflict?: string },
) {
  return supabase.from(table).upsert({ ...row, user_id: userId }, options)
}
