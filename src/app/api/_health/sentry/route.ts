// Sentry wiring verification endpoint.
//
// Hits this endpoint to confirm Sentry is receiving events from production.
// Guarded by HEALTH_SYNC_TOKEN (the same shared secret that protects other
// service-to-service health probes) so it cannot be triggered by the
// public, even with the URL leaked.
//
// Usage:
//   curl -H "Authorization: Bearer $HEALTH_SYNC_TOKEN" \
//     https://your-app.vercel.app/api/_health/sentry?action=throw
//
// Actions:
//   ?action=throw    -> throws an error (verifies error capture path)
//   ?action=message  -> sends an info-level message (verifies basic delivery)
//   (no action)      -> returns Sentry config status without sending anything

import * as Sentry from '@sentry/nextjs'

export const dynamic = 'force-dynamic'

function isAuthorized(request: Request): boolean {
  const expected = process.env.HEALTH_SYNC_TOKEN
  if (!expected) return false
  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${expected}`
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const action = url.searchParams.get('action')

  const dsnPresent = Boolean(process.env.SENTRY_DSN)
  const clientDsnPresent = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN)

  if (action === 'throw') {
    throw new Error(
      `Sentry wiring test thrown at ${new Date().toISOString()}. ` +
        'If you can see this in Sentry, capture is working.',
    )
  }

  if (action === 'message') {
    Sentry.captureMessage(
      `Sentry wiring test message at ${new Date().toISOString()}.`,
      'info',
    )
    return Response.json({
      ok: true,
      sent: 'message',
      sentry_configured: dsnPresent,
    })
  }

  return Response.json({
    ok: true,
    sentry_server_dsn_configured: dsnPresent,
    sentry_client_dsn_configured: clientDsnPresent,
    instructions: 'Pass ?action=throw or ?action=message to send a test event.',
  })
}
