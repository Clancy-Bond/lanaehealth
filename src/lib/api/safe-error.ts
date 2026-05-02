// Safe error helpers for API route handlers (Track D, sweep 2026-04-19).
//
// Supabase / Postgres error messages are useful in development but leak
// schema details (column names, constraint names, error codes) in
// production. Routes should use `safeErrorBody()` so prod responses
// stay opaque while dev keeps the underlying message for debugging.

import { NextResponse } from 'next/server'
import { UnauthorizedError, requireUser, type AuthedUser } from './require-user'

function isProd(): boolean {
  return process.env.NODE_ENV === 'production'
}

export function safeErrorMessage(err: unknown, fallback = 'internal_error'): string {
  if (isProd()) return fallback
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err)
  } catch {
    return fallback
  }
}

export function safeErrorBody(
  err: unknown,
  opts?: { fallback?: string; code?: string },
): { error: string; code?: string } {
  const out: { error: string; code?: string } = {
    error: safeErrorMessage(err, opts?.fallback ?? 'internal_error'),
  }
  if (opts?.code) out.code = opts.code
  return out
}

/**
 * One-stop response for a thrown error: maps UnauthorizedError to 401,
 * everything else to a sanitized 500. Use inside a top-level try/catch
 * in a route handler.
 */
export function safeErrorResponse(err: unknown, fallback = 'internal_error'): NextResponse {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return NextResponse.json(safeErrorBody(err, { fallback }), { status: 500 })
}

type RouteHandler = (req: Request) => Promise<NextResponse> | NextResponse
type DynamicRouteHandler<C> = (
  req: Request,
  ctx: C,
) => Promise<NextResponse> | NextResponse

/**
 * Wrap a route handler with auth enforcement and a top-level error
 * catcher. Returns a 401 if the request is not authenticated, a
 * sanitized 500 if the handler throws.
 *
 * Use `withAuthedRoute(async (req) => ...)` for non-dynamic routes,
 * or pass an arity-3 handler `(req, ctx, user) => ...` for dynamic
 * ones via `withAuthedDynamicRoute`.
 */
export function withAuthedRoute(
  handler: (req: Request, user: AuthedUser) => Promise<NextResponse> | NextResponse,
): RouteHandler {
  return async (req: Request) => {
    let user: AuthedUser
    try {
      user = await requireUser(req)
    } catch (err) {
      return safeErrorResponse(err)
    }
    try {
      return await handler(req, user)
    } catch (err) {
      return safeErrorResponse(err)
    }
  }
}

export function withAuthedDynamicRoute<C>(
  handler: (req: Request, ctx: C, user: AuthedUser) => Promise<NextResponse> | NextResponse,
): DynamicRouteHandler<C> {
  return async (req: Request, ctx: C) => {
    let user: AuthedUser
    try {
      user = await requireUser(req)
    } catch (err) {
      return safeErrorResponse(err)
    }
    try {
      return await handler(req, ctx, user)
    } catch (err) {
      return safeErrorResponse(err)
    }
  }
}
