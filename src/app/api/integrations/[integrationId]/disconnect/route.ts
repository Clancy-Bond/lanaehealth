/**
 * Integration Disconnect
 * POST /api/integrations/[integrationId]/disconnect
 *
 * Disconnects an integration by revoking tokens and removing from DB.
 * Imported data is NOT deleted.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getConnector, getToken, deleteToken } from '@/lib/integrations/hub'
import type { IntegrationId } from '@/lib/integrations/types'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> },
) {
  const { integrationId } = await params
  const connector = getConnector(integrationId as IntegrationId)

  if (!connector) {
    return NextResponse.json({ error: 'Unknown integration' }, { status: 404 })
  }

  const token = await getToken(integrationId as IntegrationId)

  if (token) {
    try {
      await connector.disconnect(token)
    } catch {
      // Best effort revocation -- delete token regardless
    }
    await deleteToken(integrationId as IntegrationId)
  }

  return NextResponse.json({ success: true, message: `${integrationId} disconnected. Your imported data has been kept.` })
}
