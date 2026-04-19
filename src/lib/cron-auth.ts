import { NextResponse } from 'next/server'
import { timingSafeEqualStrings } from './constant-time'

/**
 * Validate that an incoming request is a Vercel cron invocation.
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET` when the
 * `CRON_SECRET` env var is present on the project. We reject any
 * request that does not carry the header OR is missing the server-side
 * env var: fail-closed is the only safe default for destructive /
 * cost-incurring jobs.
 *
 * We do NOT trust `x-vercel-cron: 1` as a standalone signal. Any
 * attacker can set that header on an inbound request.
 */
export function isVercelCron(req: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const header = req.headers.get('authorization') ?? ''
  if (!header.toLowerCase().startsWith('bearer ')) return false
  const provided = header.slice(7).trim()
  return timingSafeEqualStrings(provided, expected)
}

/**
 * Guard helper for cron route handlers. Returns a 401 `NextResponse`
 * when the request is not a valid cron invocation, or `null` to signal
 * the handler should proceed.
 */
export function requireCronAuth(req: Request): NextResponse | null {
  if (isVercelCron(req)) return null
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
}
