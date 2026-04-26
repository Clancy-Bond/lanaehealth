// Production-safe JSON error helpers for API routes.
//
// Raw `error.message` strings from Supabase, Postgres, and external SDKs
// frequently contain schema details, column names, index names, and row
// counts. Returning them to the browser leaks the DB shape to anyone who
// can trip a 500. In production we fold every error into a stable
// generic message keyed by a short code. In dev we keep the detail so
// engineers can still debug locally.
//
// Usage:
//   return jsonError(500, 'db_write_failed', err)
//   return jsonError(400, 'bad_body')
//
// Every call also logs the raw error server-side so operators can trace
// it through Vercel / Supabase logs.

export function isProd(): boolean {
  return process.env.NODE_ENV === 'production'
}

export function safeMessage(err: unknown, fallback = 'Internal error.'): string {
  if (isProd()) return fallback
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return fallback
}

export function jsonError(
  status: number,
  code: string,
  err?: unknown,
  fallback?: string,
): Response {
  if (err !== undefined) {
    // Always log the raw error server-side. Safe - logs are not returned
    // to the client.
    console.error(`[api-error] ${code}:`, err)
  }
  const body: { error: string; code: string } = {
    error: safeMessage(err, fallback ?? defaultMessageFor(status)),
    code,
  }
  return Response.json(body, { status })
}

function defaultMessageFor(status: number): string {
  if (status === 400) return 'Bad request.'
  if (status === 401) return 'Unauthorized.'
  if (status === 403) return 'Forbidden.'
  if (status === 404) return 'Not found.'
  if (status === 409) return 'Conflict.'
  if (status === 429) return 'Rate limited.'
  return 'Internal error.'
}
