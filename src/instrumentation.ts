// Next.js App Router instrumentation hook.
// Runs once per server/edge runtime cold start. Wires up Sentry so unhandled
// errors in route handlers, server components, and middleware get reported.
//
// Sentry SDK note: as of @sentry/nextjs v10 the legacy `sentry.server.config.ts`
// and `sentry.edge.config.ts` files are still supported but Sentry recommends
// initializing inside the `register()` hook for Turbopack compatibility.

import * as Sentry from '@sentry/nextjs'

import { sentryBeforeSend } from './lib/observability/sentry-scrubber'

export async function register() {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) {
    // No DSN means Sentry is not configured for this environment. Silently
    // no-op so local dev and previews without monitoring still boot cleanly.
    return
  }

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init({
      dsn,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
      release: process.env.VERCEL_GIT_COMMIT_SHA,
      // Catch errors only for now. Performance tracing samples can be turned
      // on once we know we are not exceeding the free quota.
      tracesSampleRate: 0,
      // PHI scrubber. See sentry-scrubber.ts for the field allowlist.
      beforeSend: sentryBeforeSend,
      // Drop spans before they leave the process; we are not running tracing.
      beforeSendTransaction: () => null,
    })
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
      release: process.env.VERCEL_GIT_COMMIT_SHA,
      tracesSampleRate: 0,
      beforeSend: sentryBeforeSend,
      beforeSendTransaction: () => null,
    })
  }
}

// onRequestError forwards Next.js request errors (server components, route
// handlers, middleware) into Sentry with the right request scope. Required
// for App Router error capture on Next.js 15+/16.
export const onRequestError = Sentry.captureRequestError
