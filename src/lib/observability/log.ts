/**
 * Structured logging helper.
 *
 * Vercel automatically captures stdout/stderr from server functions and
 * makes them queryable in the Vercel dashboard. By emitting JSON we get
 * filterable structured logs without needing a third-party log
 * aggregator. This is the ground truth even when Sentry is misconfigured
 * or unset, which is the real-world fallback we need.
 *
 * Calling logError() also forwards the event to Sentry when a DSN is
 * configured. Sentry capture is best-effort: if the SDK is not loaded
 * (no DSN, edge runtime without init, etc.) we silently swallow the
 * forwarding failure and rely on the JSON line being captured by Vercel.
 *
 * PHI hygiene rules (caller responsibility):
 *   - Do not pass raw request bodies in `tags` or `context`. Pass shape
 *     descriptors only (e.g. fieldCount, has_x).
 *   - Error messages from postgres can echo column values into the
 *     output. The Sentry scrubber catches the most common PHI keys, but
 *     this logger does not scrub. Treat `error.message` as PII.
 *   - When in doubt, omit. Stack traces alone are usually enough to
 *     reproduce.
 */

import * as Sentry from '@sentry/nextjs'

export interface LogErrorInput {
  /** A short context string identifying where the error happened. e.g. 'cycle/log'. */
  context: string
  /** The error itself. Either an Error instance or a string. */
  error: unknown
  /** Optional flat key/value tags. Keep small and PHI-free. */
  tags?: Record<string, string | number | boolean>
}

interface StructuredLogLine {
  level: 'error'
  ts: string
  context: string
  message: string
  stack?: string
  tags?: Record<string, string | number | boolean>
}

function toMessage(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack }
  }
  if (typeof err === 'string') {
    return { message: err }
  }
  try {
    return { message: JSON.stringify(err) }
  } catch {
    return { message: 'unserializable error' }
  }
}

/**
 * Log an error with structured context.
 *
 * Writes one JSON line to stderr (Vercel ingests this) and forwards to
 * Sentry when configured. Never throws. Never blocks.
 */
export function logError(input: LogErrorInput): void {
  const { context, error, tags } = input
  const { message, stack } = toMessage(error)

  const line: StructuredLogLine = {
    level: 'error',
    ts: new Date().toISOString(),
    context,
    message,
    stack,
    tags,
  }

  // Write JSON line to stderr. Vercel captures this and exposes it in
  // the dashboard with full-text search.
  try {
    // Use process.stderr.write to avoid the [Object] formatting that
    // console.error applies on some Node versions.
    process.stderr.write(JSON.stringify(line) + '\n')
  } catch {
    // Last-ditch: console.error. Should never fail in practice.
    console.error('[logError]', line)
  }

  // Forward to Sentry. Best-effort; Sentry may be a no-op when DSN unset.
  try {
    if (error instanceof Error) {
      Sentry.captureException(error, {
        tags: tags
          ? Object.fromEntries(
              Object.entries(tags).map(([k, v]) => [k, String(v)]),
            )
          : undefined,
        extra: { context },
      })
    } else {
      Sentry.captureMessage(`${context}: ${message}`, {
        level: 'error',
        tags: tags
          ? Object.fromEntries(
              Object.entries(tags).map(([k, v]) => [k, String(v)]),
            )
          : undefined,
      })
    }
  } catch {
    // Silently ignore Sentry forwarding failures. The structured log
    // line above is the source of truth.
  }
}

/**
 * Convenience: log a warning-level structured event.
 */
export function logWarn(input: LogErrorInput): void {
  const { context, error, tags } = input
  const { message, stack } = toMessage(error)

  const line = {
    level: 'warn' as const,
    ts: new Date().toISOString(),
    context,
    message,
    stack,
    tags,
  }

  try {
    process.stderr.write(JSON.stringify(line) + '\n')
  } catch {
    console.warn('[logWarn]', line)
  }
}
