/**
 * Integration OAuth Callback
 * GET /api/integrations/[integrationId]/callback
 *
 * Handles the OAuth redirect from the provider, exchanges code for tokens,
 * stores tokens, and redirects back to Settings.
 *
 * CSRF gate (C-003): requires the `state` query param to match the
 * httpOnly `oauth_state_<integrationId>` cookie that was set by the
 * authorize route. Constant-time comparison to avoid timing oracles.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getConnector, saveToken } from '@/lib/integrations/hub'
import type { IntegrationId } from '@/lib/integrations/types'
import { timingSafeEqualStrings } from '@/lib/constant-time'

export const dynamic = 'force-dynamic'

function redirectWithError(req: NextRequest, integrationId: string, cookieName: string, key: string): NextResponse {
  const response = NextResponse.redirect(
    new URL(`/settings?error=${encodeURIComponent(key)}&integration=${integrationId}`, req.url),
  )
  response.cookies.delete(cookieName)
  return response
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> },
) {
  const { integrationId } = await params
  const connector = getConnector(integrationId as IntegrationId)

  if (!connector) {
    return NextResponse.redirect(new URL('/settings?error=unknown_integration', req.url))
  }

  const cookieName = `oauth_state_${integrationId}`
  const code = req.nextUrl.searchParams.get('code')
  const error = req.nextUrl.searchParams.get('error')
  const state = req.nextUrl.searchParams.get('state')
  const storedState = req.cookies.get(cookieName)?.value ?? null

  if (error) {
    return redirectWithError(req, integrationId, cookieName, error)
  }

  if (!storedState || !state || !timingSafeEqualStrings(state, storedState)) {
    return redirectWithError(req, integrationId, cookieName, 'state_mismatch')
  }

  if (!code) {
    return redirectWithError(req, integrationId, cookieName, 'no_code')
  }

  const origin = req.nextUrl.origin
  const redirectUri = `${origin}/api/integrations/${integrationId}/callback`

  try {
    const token = await connector.exchangeCode(code, redirectUri)
    await saveToken(token)

    const response = NextResponse.redirect(
      new URL(`/settings?connected=${integrationId}`, req.url),
    )
    response.cookies.delete(cookieName)
    return response
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Token exchange failed'
    console.error('[integrations/callback] exchange failed', { integrationId, message })
    return redirectWithError(req, integrationId, cookieName, 'exchange_failed')
  }
}
