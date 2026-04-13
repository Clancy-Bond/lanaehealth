import { NextResponse } from 'next/server'

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

  const scopes = 'daily heartrate sleep spo2 stress personal'
  const authUrl = new URL('https://cloud.ouraring.com/oauth/authorize')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', scopes)
  authUrl.searchParams.set('state', 'lanaehealth')

  return NextResponse.redirect(authUrl.toString())
}
