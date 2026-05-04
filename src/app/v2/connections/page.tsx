/*
 * /v2/connections — server component
 *
 * Reads the connector registry + tokens table directly. No round trip
 * through /api/integrations/status because making a server-component
 * fetch back to the dev server can deadlock during cold Turbopack
 * compiles (the API route and the page route compile concurrently).
 *
 * The /api/integrations/status endpoint stays available for external
 * callers (browser-side polling, mobile native shell, etc.).
 */
import { createServiceClient } from '@/lib/supabase'
import { getAllConfigs } from '@/lib/integrations/hub'
import '@/lib/integrations/registry'
import ConnectionsClient from './_components/ConnectionsClient'
import type { StatusRow } from './_components/ConnectionCard'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Connections',
}

interface TokenRow {
  integration_id: string
  expires_at: string | null
  updated_at: string | null
}

export default async function V2ConnectionsPage() {
  let tokens: TokenRow[] = []
  try {
    const sb = createServiceClient()
    const { data } = (await sb
      .from('integration_tokens')
      .select('integration_id, expires_at, updated_at')) as {
      data: TokenRow[] | null
    }
    tokens = data ?? []
  } catch {
    // soft-fail; render with empty token state
  }

  const tokenMap = new Map<string, TokenRow>()
  for (const t of tokens) tokenMap.set(t.integration_id, t)

  const now = Date.now()
  const integrations: StatusRow[] = getAllConfigs().map((cfg) => {
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

  return <ConnectionsClient integrations={integrations} />
}
