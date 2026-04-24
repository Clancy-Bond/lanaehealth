// Client-side Sentry initialization. Runs once in the browser when the app
// boots. Captures unhandled exceptions and unhandled promise rejections from
// React render, event handlers, and async code.
//
// File name and location are mandated by Next.js (see
// https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client).

import * as Sentry from '@sentry/nextjs'

import { sentryBeforeSend } from './lib/observability/sentry-scrubber'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    // Errors only for now. Browser perf tracing adds noticeable bundle weight
    // and we have not budgeted for it.
    tracesSampleRate: 0,
    // Replay is off because session video would absolutely contain PHI.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend: sentryBeforeSend,
    beforeSendTransaction: () => null,
  })
}

// Required for client-side router transitions to be tracked by Sentry.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
