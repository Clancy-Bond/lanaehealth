import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens, storeTokens } from '@/lib/oura'
import { timingSafeEqualStrings } from '@/lib/constant-time'

export const dynamic = 'force-dynamic'

function redirectWithError(request: NextRequest, key: string): NextResponse {
  const response = NextResponse.redirect(
    new URL(`/settings?oura_error=${encodeURIComponent(key)}`, request.url),
  )
  // Clear the state cookie so it cannot be replayed.
  response.cookies.delete('oura_oauth_state')
  return response
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const state = searchParams.get('state')
  const storedState = request.cookies.get('oura_oauth_state')?.value ?? null

  if (error) {
    return redirectWithError(request, error)
  }

  // CSRF gate (C-003): require matching, unguessable state. The authorize
  // route sets a 10-minute cookie that only the legitimate initiator
  // has. Without it, an attacker who tricked the patient into clicking
  // an attacker-crafted callback URL could link the attacker's Oura
  // account to the patient's tokens.
  if (!storedState || !state || !timingSafeEqualStrings(state, storedState)) {
    return redirectWithError(request, 'state_mismatch')
  }

  if (!code) {
    return redirectWithError(request, 'no_code')
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    await storeTokens(tokens)

    const response = NextResponse.redirect(
      new URL('/settings?oura_connected=true', request.url),
    )
    response.cookies.delete('oura_oauth_state')
    return response
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[oura/callback] token exchange failed', { message })
    return redirectWithError(request, 'exchange_failed')
  }
}
