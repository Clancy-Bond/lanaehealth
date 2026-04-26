/**
 * Tracing helpers for critical paths.
 *
 * Wraps Sentry.startSpan with a typed signature so callers do not need to
 * import Sentry directly. When Sentry is unset (no DSN, edge runtime
 * without init, etc.) the helper still runs the work synchronously and
 * returns the result. tracesSampleRate currently defaults to 0 in
 * instrumentation.ts; switching it on later only requires changing that
 * one number, with no caller refactor needed.
 *
 * Use it on:
 *   - HTTP route handlers that touch Anthropic, Supabase, or external APIs
 *   - Three-Layer Context Engine entry points (assembleDynamicContext,
 *     loadCycleContext, etc.)
 *   - Hourly cron jobs
 *
 * Do NOT use it on:
 *   - Tight inner loops; tracing overhead can dominate
 *   - Synchronous pure functions
 *   - Anything that would be called more than ~100 times per request
 */

import * as Sentry from '@sentry/nextjs'

type SpanOp =
  | 'http.server'
  | 'db.query'
  | 'function'
  | 'ai.chat_completion'
  | 'ai.context_assemble'
  | 'cron'

export interface TraceOptions {
  /** Display name in the Sentry trace UI. Required. */
  name: string
  /** Span op category. Helps grouping in Sentry. */
  op?: SpanOp
  /** Optional flat key/value attributes. PHI-free per usual. */
  attributes?: Record<string, string | number | boolean>
}

/**
 * Wrap an async block in a Sentry span. Returns whatever the block
 * returns. If the block throws, the exception is captured (with PHI
 * scrubber applied via the global beforeSend hook) and re-thrown so
 * the caller's existing error handling still runs.
 */
export async function trace<T>(
  options: TraceOptions,
  fn: () => Promise<T>,
): Promise<T> {
  const { name, op = 'function', attributes } = options

  return Sentry.startSpan(
    {
      name,
      op,
      attributes,
    },
    async () => {
      return fn()
    },
  )
}
