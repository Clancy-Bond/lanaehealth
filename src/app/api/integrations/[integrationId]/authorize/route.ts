/**
 * Integration OAuth Authorization
 * GET /api/integrations/[integrationId]/authorize
 *
 * Redirects user to the provider's OAuth authorization page.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getConnector } from '@/lib/integrations/hub'
import type { IntegrationId } from '@/lib/integrations/types'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> },
) {
  const { integrationId } = await params
  const connector = getConnector(integrationId as IntegrationId)

  if (!connector) {
    return NextResponse.json(
      { error: `Unknown integration: ${integrationId}` },
      { status: 404 },
    )
  }

  const origin = req.nextUrl.origin
  const redirectUri = `${origin}/api/integrations/${integrationId}/callback`
  const state = crypto.randomUUID()

  // Store state in a cookie for CSRF protection
  const authUrl = connector.getAuthUrl(redirectUri, state)

  const response = NextResponse.redirect(authUrl)
  response.cookies.set(`oauth_state_${integrationId}`, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600, // 10 minutes
    path: '/',
    sameSite: 'lax',
  })

  return response
}
