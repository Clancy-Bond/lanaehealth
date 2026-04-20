import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'

export const dynamic = 'force-dynamic'

export async function GET() {
  const clientId = process.env.OURA_CLIENT_ID?.trim()
  const redirectUri = process.env.OURA_REDIRECT_URI?.trim()

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      {
        error: 'Oura OAuth not configured',
        debug: {
          hasClientId: !!clientId,
          hasRedirectUri: !!redirectUri,
        },
      },
      { status: 500 }
    )
  }

  // CSRF protection (C-003): generate an unguessable state per authorize
  // and require the callback to match it against a short-lived cookie.
  const state = randomBytes(32).toString('base64url')

  const scopes = 'daily heartrate sleep spo2 stress personal'
  const authUrl = new URL('https://cloud.ouraring.com/oauth/authorize')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', scopes)
  authUrl.searchParams.set('state', state)

  const response = NextResponse.redirect(authUrl.toString())
  response.cookies.set('oura_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return response
}
