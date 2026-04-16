/**
 * Integration OAuth Callback
 * GET /api/integrations/[integrationId]/callback
 *
 * Handles the OAuth redirect from the provider, exchanges code for tokens,
 * stores tokens, and redirects back to Settings.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getConnector, saveToken } from '@/lib/integrations/hub'
import type { IntegrationId } from '@/lib/integrations/types'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> },
) {
  const { integrationId } = await params
  const connector = getConnector(integrationId as IntegrationId)

  if (!connector) {
    return NextResponse.redirect(new URL('/settings?error=unknown_integration', req.url))
  }

  const code = req.nextUrl.searchParams.get('code')
  const error = req.nextUrl.searchParams.get('error')

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(error)}&integration=${integrationId}`, req.url),
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL(`/settings?error=no_code&integration=${integrationId}`, req.url),
    )
  }

  const origin = req.nextUrl.origin
  const redirectUri = `${origin}/api/integrations/${integrationId}/callback`

  try {
    const token = await connector.exchangeCode(code, redirectUri)
    await saveToken(token)

    // Clear the state cookie
    const response = NextResponse.redirect(
      new URL(`/settings?connected=${integrationId}`, req.url),
    )
    response.cookies.delete(`oauth_state_${integrationId}`)
    return response
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Token exchange failed'
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(msg)}&integration=${integrationId}`, req.url),
    )
  }
}
