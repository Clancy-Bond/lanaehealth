/**
 * Identify the currently signed-in Supabase Auth user.
 *
 * Two helpers:
 *   - getCurrentUser(): returns the user or null. Use when the
 *     route or component should degrade gracefully if there is
 *     no session.
 *   - requireUser(): throws if no session. Use in API routes
 *     where missing auth means 401.
 *
 * These read from the SSR Supabase client (cookies on the
 * request). They do NOT consult the legacy single-secret
 * `lh_session` cookie. That cookie is still honored by the
 * middleware perimeter and by `requireAuth()` for tooling
 * (cron, iOS Shortcut) but it carries no user identity.
 *
 * Multi-user routes that need to know "which user is asking"
 * should prefer these helpers over `requireAuth()`.
 */
import type { User } from '@supabase/supabase-js'
import { getSupabaseServerClient } from './supabase-server'

export class UnauthenticatedError extends Error {
  constructor(message = 'unauthenticated') {
    super(message)
    this.name = 'UnauthenticatedError'
  }
}

/**
 * Returns the current Supabase Auth user, or null if there is
 * no active session. Never throws.
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = await getSupabaseServerClient()
    const { data, error } = await supabase.auth.getUser()
    if (error) return null
    return data.user ?? null
  } catch {
    return null
  }
}

/**
 * Returns the current Supabase Auth user. Throws
 * UnauthenticatedError if no session is present. Route handlers
 * should catch and return a 401.
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) throw new UnauthenticatedError()
  return user
}
