/**
 * User-scoped server access helpers for PHI route handlers. See migration 038.
 */
import { NextResponse } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { getCurrentUser } from './get-user'
import { resolveUserId, UserIdUnresolvableError } from './resolve-user-id'
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

/**
 * Like requireUserScope() but accepts the legacy single-secret tooling
 * path too. Resolves user_id either from the Supabase session (multi-user
 * web app) or from OWNER_USER_ID env (iOS Shortcut, cron, CLI).
 *
 * Use this in PHI read/write routes that ALREADY pass requireAuth() for
 * the legacy tooling and need a user_id to scope the query.
 */
export interface UserIdScopeOk {
  ok: true
  userId: string
  via: 'session' | 'owner_env'
  supabase: SupabaseClient
}
export interface UserIdScopeFail { ok: false; response: Response }
export type UserIdScope = UserIdScopeOk | UserIdScopeFail

export async function requireUserIdScope(): Promise<UserIdScope> {
  try {
    const r = await resolveUserId()
    return { ok: true, userId: r.userId, via: r.via, supabase: createServiceClient() }
  } catch (err) {
    if (err instanceof UserIdUnresolvableError) {
      return { ok: false, response: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }) }
    }
    return { ok: false, response: NextResponse.json({ error: 'auth check failed' }, { status: 500 }) }
  }
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
