/**
 * Route-handler wrapper that injects the signed-in Supabase
 * Auth user.
 *
 *   import { withUser } from '@/lib/auth/with-auth'
 *
 *   export const GET = withUser(async (_req, { user }) => {
 *     return NextResponse.json({ id: user.id })
 *   })
 *
 * On no session this returns a 401 JSON response. The handler
 * never runs.
 *
 * Multi-user identity is separate from the legacy shared-secret
 * gate (`requireAuth()` in `require-user.ts`). The shared
 * secret stays for cron + iOS Shortcut compatibility; this
 * wrapper is for routes that act on a specific user's data.
 */
import { NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { getCurrentUser } from './get-user'

export interface AuthedContext {
  user: User
}

export type AuthedRouteHandler<TParams = unknown> = (
  req: NextRequest,
  ctx: AuthedContext & { params?: TParams },
) => Promise<Response> | Response

/**
 * Wrap a route handler so it only runs when a signed-in user is
 * present. The user is injected as `ctx.user`. Pre-existing
 * `params` (Next.js dynamic segments) are forwarded untouched.
 */
export function withUser<TParams = unknown>(
  handler: AuthedRouteHandler<TParams>,
): (req: NextRequest, ctx?: { params?: TParams }) => Promise<Response> {
  return async function wrapped(req, ctx) {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }
    return handler(req, { user, params: ctx?.params })
  }
}
