/**
 * Resolve the user_id to scope a PHI write or read against.
 *
 * Two callers, two paths:
 *
 *   1. v2 multi-user surface (web app, Next.js cookie-based session)
 *      → uses Supabase Auth session via getCurrentUser().
 *      Multi-user safe; per-call user_id is unique per signed-in user.
 *
 *   2. Legacy single-secret tooling (iOS Shortcut, cron, CLI)
 *      → uses APP_AUTH_TOKEN through requireAuth(req).
 *      No user identity in the request; needs an owner-user fallback.
 *      OWNER_USER_ID env var (set to Lanae's auth.users.id) is the
 *      canonical owner. If unset, the helper refuses to scope writes
 *      so we never accidentally insert a row with NULL user_id.
 *
 * The PR-#81 follow-up (this file) introduces this so the 35 PHI route
 * refactor can stamp user_id on every write without breaking the legacy
 * tooling paths. After v2 launch, OWNER_USER_ID can be removed and the
 * legacy tooling paths fully retired.
 */
import { getCurrentUser } from './get-user'

export interface ResolvedUserId {
  userId: string
  via: 'session' | 'owner_env'
}

export class UserIdUnresolvableError extends Error {
  constructor(message = 'cannot resolve user_id: no session and OWNER_USER_ID unset') {
    super(message)
    this.name = 'UserIdUnresolvableError'
  }
}

/**
 * Resolve the user_id for the current request. Prefers a Supabase
 * Auth session (multi-user safe). Falls back to OWNER_USER_ID for
 * legacy single-secret tooling paths.
 *
 * Throws UserIdUnresolvableError when both paths are unavailable so
 * the caller can return 401/500 cleanly.
 */
export async function resolveUserId(): Promise<ResolvedUserId> {
  const user = await getCurrentUser()
  if (user) return { userId: user.id, via: 'session' }
  const owner = process.env.OWNER_USER_ID
  if (owner && /^[0-9a-fA-F-]{36}$/.test(owner)) {
    return { userId: owner, via: 'owner_env' }
  }
  throw new UserIdUnresolvableError()
}
