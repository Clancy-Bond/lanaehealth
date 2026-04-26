/**
 * Deliberate-error endpoint for end-to-end Sentry verification.
 *
 * The unique tag in the thrown error message lets you grep the Sentry
 * dashboard to confirm capture from production. The route is gated by
 * SENTRY_TEST_TOKEN so it cannot be triggered by anyone without the
 * shared secret, even with the URL leaked.
 *
 * Usage:
 *   curl -X POST -H "Authorization: Bearer $SENTRY_TEST_TOKEN" \
 *     https://your-app.vercel.app/api/test/sentry-error
 *
 * Verification:
 *   1. POST this endpoint from a machine with the token.
 *   2. Open Sentry dashboard, search for "lanaehealth-sentry-test-2026-04-26".
 *   3. If the event appears, end-to-end capture works.
 *   4. If not, recheck SENTRY_DSN env on Vercel and the build/runtime
 *      logs for a Sentry init message.
 *
 * Companion endpoint: /api/_health/sentry?action=throw covers the same
 * verification path via GET. Both exist so you can test either entry
 * point without disabling the other.
 */

import * as Sentry from '@sentry/nextjs'

import { logError } from '@/lib/observability/log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const TEST_TAG = 'lanaehealth-sentry-test-2026-04-26'

function isAuthorized(request: Request): boolean {
  const expected = process.env.SENTRY_TEST_TOKEN
  if (!expected) return false
  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${expected}`
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json(
      { error: 'Unauthorized. Set SENTRY_TEST_TOKEN and pass it as a Bearer.' },
      { status: 401 },
    )
  }

  // Tag the scope so we can locate this exact event in the Sentry UI by
  // searching for the tag value.
  Sentry.withScope((scope) => {
    scope.setTag('test_marker', TEST_TAG)
    scope.setLevel('error')

    const err = new Error(
      `Deliberate Sentry test error. Marker: ${TEST_TAG}. ` +
        `Thrown at ${new Date().toISOString()}.`,
    )

    // Forward through the structured logger as well, so the JSON line
    // shows up in Vercel logs even when Sentry is misconfigured.
    logError({
      context: 'api/test/sentry-error',
      error: err,
      tags: {
        test_marker: TEST_TAG,
        deliberate: true,
      },
    })

    Sentry.captureException(err)
  })

  return Response.json(
    {
      ok: true,
      sent: 'error',
      tag: TEST_TAG,
      sentry_server_dsn_configured: Boolean(process.env.SENTRY_DSN),
      sentry_client_dsn_configured: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
      next_step:
        `Search the Sentry dashboard for the marker tag "${TEST_TAG}" ` +
        'or the literal string "lanaehealth-sentry-test-2026-04-26".',
    },
    { status: 500 },
  )
}
