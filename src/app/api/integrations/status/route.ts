/*
 * GET /api/integrations/status
 *
 * Returns one row per registered connector with current connection
 * state. Used by /v2/connections to render its cards.
 *
 * The hub registry is populated via side-effect import of
 * src/lib/integrations/registry.ts. Token rows live in
 * `integration_tokens` (migration 010). We treat `updated_at` as a
 * proxy for "last activity" until a dedicated last_synced_at column
 * lands in a future migration.
 */
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAllConfigs } from '@/lib/integrations/hub'
import '@/lib/integrations/registry'

export const dynamic = 'force-dynamic'

interface TokenRow {
  integration_id: string
  expires_at: string | null
  updated_at: string | null
}

interface StatusRow {
  id: string
  name: string
  description: string
  icon: string
  category: string
  dataTypes: string[]
  connected: boolean
  expired: boolean
  lastActivityAt: string | null
  expiresAt: string | null
}

export async function GET() {
  const sb = createServiceClient()
  const { data: tokens } = (await sb
    .from('integration_tokens')
    .select('integration_id, expires_at, updated_at')) as {
    data: TokenRow[] | null
  }

  const tokenMap = new Map<string, TokenRow>()
  for (const t of tokens ?? []) tokenMap.set(t.integration_id, t)

  const now = Date.now()
  const rows: StatusRow[] = getAllConfigs().map((cfg) => {
    const tok = tokenMap.get(cfg.id)
    const expired = !!tok?.expires_at && new Date(tok.expires_at).getTime() < now
    return {
      id: cfg.id,
      name: cfg.name,
      description: cfg.description,
      icon: cfg.icon,
      category: cfg.category,
      dataTypes: cfg.dataTypes,
      connected: !!tok && !expired,
      expired,
      lastActivityAt: tok?.updated_at ?? null,
      expiresAt: tok?.expires_at ?? null,
    }
  })

  return NextResponse.json({ integrations: rows })
}
