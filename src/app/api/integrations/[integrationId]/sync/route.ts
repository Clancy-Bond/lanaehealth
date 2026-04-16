/**
 * Integration Sync
 * POST /api/integrations/[integrationId]/sync
 *
 * Triggers a data sync for a connected integration.
 * Body: { startDate?: string, endDate?: string }
 * Defaults to last 30 days.
 */

import { NextRequest, NextResponse } from 'next/server'
import { syncIntegration } from '@/lib/integrations/hub'
import type { IntegrationId } from '@/lib/integrations/types'

export const maxDuration = 120

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> },
) {
  const { integrationId } = await params

  let startDate: string
  let endDate: string

  try {
    const body = await req.json()
    endDate = body.endDate ?? new Date().toISOString().slice(0, 10)
    startDate = body.startDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  } catch {
    endDate = new Date().toISOString().slice(0, 10)
    startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  }

  const result = await syncIntegration(integrationId as IntegrationId, startDate, endDate)

  return NextResponse.json(result, {
    status: result.success ? 200 : 500,
  })
}
