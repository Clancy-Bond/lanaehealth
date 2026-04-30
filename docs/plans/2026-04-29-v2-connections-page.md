# v2 Connections Page Implementation Plan (Phase 1)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Surface every existing integration in v2 on a single discoverable screen, so users on iPhone can see what's connected and connect what isn't, without dropping into legacy `/settings`.

**Architecture:** New route `/v2/connections` is a server component that queries integration token state from Supabase, then hands an array of `{ integration, connected, lastSyncedAt }` to a v2-styled client component. The client component reuses the existing `/api/integrations/[id]/{authorize,sync,disconnect}` endpoints. No new server logic; this is a pure presentation port.

**Tech Stack:** Next.js 16 server components + v2 primitives (Card, Button, Banner) + Supabase + existing `src/lib/integrations/` registry.

**Scope discipline:** Phase 1 ships UI discoverability for what already works. It does NOT add `HKClinicalRecord`, email-ingest, or aggregator integration — those are Phases 2-5 in `docs/plans/2026-04-29-medical-data-aggregation-design.md`.

---

## Task 1: Status endpoint

**Files:**
- Create: `src/app/api/integrations/status/route.ts`
- Test: `src/app/api/integrations/status/__tests__/route.test.ts` (deferred to Task 8 E2E since unit tests need Supabase mocks)

**Step 1: Implement the endpoint**

```typescript
// src/app/api/integrations/status/route.ts
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getAllConnectors } from '@/lib/integrations/hub'
import '@/lib/integrations/registry' // side-effect: registers connectors

export const dynamic = 'force-dynamic'

interface StatusRow {
  id: string
  name: string
  description: string
  icon: string
  category: string
  dataTypes: string[]
  connected: boolean
  lastSyncedAt: string | null
  expiresAt: string | null
}

export async function GET() {
  const sb = await createServerClient()
  const { data: tokens } = await sb
    .from('integration_tokens')
    .select('integration_id, last_synced_at, expires_at')

  const tokenMap = new Map(
    (tokens ?? []).map(t => [t.integration_id, t]),
  )

  const connectors = getAllConnectors()
  const rows: StatusRow[] = connectors.map(c => {
    const tok = tokenMap.get(c.config.id)
    return {
      id: c.config.id,
      name: c.config.name,
      description: c.config.description,
      icon: c.config.icon,
      category: c.config.category,
      dataTypes: c.config.dataTypes,
      connected: !!tok,
      lastSyncedAt: tok?.last_synced_at ?? null,
      expiresAt: tok?.expires_at ?? null,
    }
  })

  return NextResponse.json({ integrations: rows })
}
```

**Step 2: Verify `getAllConnectors` exists in `src/lib/integrations/hub.ts`**

Run: `grep -n "export.*getAllConnectors\\|registerConnector" src/lib/integrations/hub.ts`
Expected: at least one match.

If it doesn't exist (only `registerConnector` does), add it:
```typescript
// in src/lib/integrations/hub.ts
const REGISTRY = new Map<string, Connector>()
export function registerConnector(c: Connector) { REGISTRY.set(c.config.id, c) }
export function getAllConnectors(): Connector[] { return Array.from(REGISTRY.values()) }
export function getConnector(id: string): Connector | undefined { return REGISTRY.get(id) }
```

**Step 3: Smoke-test the endpoint by hitting it locally**

Run: `curl -s -H "Cookie: lh_session=debug" http://localhost:3005/api/integrations/status | jq '.integrations[].id'`
Expected: list of connector IDs (dexcom, whoop, garmin, withings, fhir-portal, fitbit, libre, strava).

**Step 4: Commit**

```bash
git add src/app/api/integrations/status/route.ts src/lib/integrations/hub.ts
git commit -m "feat(api): /api/integrations/status — read connector + token state"
```

---

## Task 2: V2 Connections page (server component)

**Files:**
- Create: `src/app/v2/connections/page.tsx`
- Create: `src/app/v2/connections/_components/ConnectionsClient.tsx`

**Step 1: Server component**

```typescript
// src/app/v2/connections/page.tsx
import { headers } from 'next/headers'
import ConnectionsClient from './_components/ConnectionsClient'

export const dynamic = 'force-dynamic'

interface StatusRow {
  id: string
  name: string
  description: string
  icon: string
  category: string
  dataTypes: string[]
  connected: boolean
  lastSyncedAt: string | null
  expiresAt: string | null
}

export default async function V2ConnectionsPage() {
  // Fetch via the server's own status endpoint so cookie auth flows
  // through. Same pattern the v2 doctor page uses.
  const h = await headers()
  const host = h.get('host') ?? 'localhost:3005'
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const cookie = h.get('cookie') ?? ''

  let integrations: StatusRow[] = []
  try {
    const res = await fetch(`${proto}://${host}/api/integrations/status`, {
      headers: { cookie },
      cache: 'no-store',
    })
    if (res.ok) {
      const json = (await res.json()) as { integrations: StatusRow[] }
      integrations = json.integrations
    }
  } catch {
    // soft-fail; client renders the empty state
  }

  return <ConnectionsClient integrations={integrations} />
}
```

**Step 2: Client component shell** (real card rendering in Task 3)

```typescript
// src/app/v2/connections/_components/ConnectionsClient.tsx
'use client'
import Link from 'next/link'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { Card } from '@/v2/components/primitives'
import ConnectionCard, { type StatusRow } from './ConnectionCard'

interface Props { integrations: StatusRow[] }

export default function ConnectionsClient({ integrations }: Props) {
  const connected = integrations.filter(i => i.connected)
  const disconnected = integrations.filter(i => !i.connected)

  return (
    <MobileShell
      top={
        <TopAppBar
          title="Connections"
          leading={
            <Link href="/v2/settings" aria-label="Back" style={{
              color: 'var(--v2-text-secondary)',
              fontSize: 'var(--v2-text-base)',
              padding: 'var(--v2-space-2)',
              textDecoration: 'none',
            }}>‹</Link>
          }
        />
      }
    >
      <div style={{
        maxWidth: 860,
        width: '100%',
        margin: '0 auto',
        padding: 'var(--v2-space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-4)',
      }}>
        <Card padding="md" variant="explanatory">
          <p style={{
            margin: 0,
            fontSize: 'var(--v2-text-sm)',
            lineHeight: 'var(--v2-leading-relaxed)',
          }}>
            One place for everything that feeds your health record.
            Connect a source once and it keeps itself up to date.
          </p>
        </Card>

        {connected.length > 0 && (
          <section>
            <SectionHeading label="Connected" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
              {connected.map(i => <ConnectionCard key={i.id} row={i} />)}
            </div>
          </section>
        )}

        <section>
          <SectionHeading label={connected.length > 0 ? 'Add another' : 'Connect a source'} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
            {disconnected.map(i => <ConnectionCard key={i.id} row={i} />)}
          </div>
        </section>

        <Card padding="md">
          <h3 style={{ margin: 0, fontSize: 'var(--v2-text-sm)', fontWeight: 'var(--v2-weight-semibold)' }}>
            Have a file from a portal?
          </h3>
          <p style={{
            margin: '4px 0 12px 0',
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-secondary)',
            lineHeight: 'var(--v2-leading-relaxed)',
          }}>
            PDF, FHIR Bundle, C-CDA, or screenshot. Drop it in and we'll parse it.
          </p>
          <Link href="/v2/import" style={{
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-primary)',
            textDecoration: 'underline',
          }}>Open file import</Link>
        </Card>
      </div>
    </MobileShell>
  )
}

function SectionHeading({ label }: { label: string }) {
  return (
    <h2 style={{
      margin: '0 0 var(--v2-space-2) 0',
      fontSize: 'var(--v2-text-xs)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--v2-tracking-wide)',
      color: 'var(--v2-text-muted)',
      fontWeight: 'var(--v2-weight-semibold)',
    }}>
      {label}
    </h2>
  )
}
```

**Step 3: Commit (UI shell only)**

```bash
git add src/app/v2/connections/
git commit -m "feat(v2/connections): page shell + connected/add sections"
```

---

## Task 3: ConnectionCard primitive

**Files:**
- Create: `src/app/v2/connections/_components/ConnectionCard.tsx`

**Step 1: Implement the card**

```typescript
// src/app/v2/connections/_components/ConnectionCard.tsx
'use client'
import { useState } from 'react'
import { Card, Button } from '@/v2/components/primitives'

export interface StatusRow {
  id: string
  name: string
  description: string
  icon: string
  category: string
  dataTypes: string[]
  connected: boolean
  lastSyncedAt: string | null
  expiresAt: string | null
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'never'
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.round(ms / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.round(hr / 24)
  return `${d}d ago`
}

export default function ConnectionCard({ row }: { row: StatusRow }) {
  const [busy, setBusy] = useState<'sync' | 'disconnect' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(row.connected)
  const [lastSyncedAt, setLastSyncedAt] = useState(row.lastSyncedAt)

  async function handleConnect() {
    window.location.href = `/api/integrations/${row.id}/authorize`
  }

  async function handleSync() {
    setBusy('sync')
    setError(null)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const start = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
      const res = await fetch(`/api/integrations/${row.id}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: start, endDate: today }),
      })
      if (!res.ok) {
        setError('Sync failed. Try again in a moment.')
      } else {
        setLastSyncedAt(new Date().toISOString())
      }
    } catch {
      setError('Sync failed. Try again in a moment.')
    } finally {
      setBusy(null)
    }
  }

  async function handleDisconnect() {
    if (!confirm(`Disconnect ${row.name}? We keep the data already imported.`)) return
    setBusy('disconnect')
    try {
      await fetch(`/api/integrations/${row.id}/disconnect`, { method: 'POST' })
      setConnected(false)
      setLastSyncedAt(null)
    } catch {
      setError('Disconnect failed.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card padding="md">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--v2-space-3)' }}>
        <div style={{
          width: 44,
          height: 44,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--v2-bg-elevated)',
          borderRadius: 'var(--v2-radius-md)',
          fontSize: 22,
        }}>
          {row.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--v2-space-2)', flexWrap: 'wrap' }}>
            <h3 style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
              minWidth: 0,
              overflowWrap: 'anywhere',
            }}>{row.name}</h3>
            {connected && (
              <span style={{
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-text-muted)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                synced {relativeTime(lastSyncedAt)}
              </span>
            )}
          </div>
          <p style={{
            margin: '2px 0 0 0',
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-secondary)',
            lineHeight: 'var(--v2-leading-relaxed)',
          }}>{row.description}</p>
          {error && (
            <p style={{
              margin: '6px 0 0 0',
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-accent-danger)',
            }}>{error}</p>
          )}
        </div>

        <div style={{ flexShrink: 0, display: 'flex', gap: 'var(--v2-space-2)' }}>
          {!connected ? (
            <Button variant="secondary" size="sm" onClick={handleConnect}>Connect</Button>
          ) : (
            <>
              <Button variant="tertiary" size="sm" onClick={handleSync} disabled={busy !== null}>
                {busy === 'sync' ? 'Syncing' : 'Sync'}
              </Button>
              <Button variant="tertiary" size="sm" onClick={handleDisconnect} disabled={busy !== null} aria-label={`Disconnect ${row.name}`}>
                ×
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}
```

**Step 2: Verify the page renders without errors**

Run: `npx tsc --noEmit 2>&1 | grep -E "v2/connections" | head -5`
Expected: zero matches.

Run: `curl -s -H "Cookie: lh_session=debug" -o /dev/null -w "%{http_code}" http://localhost:3005/v2/connections`
Expected: `200`.

**Step 3: Commit**

```bash
git add src/app/v2/connections/_components/ConnectionCard.tsx
git commit -m "feat(v2/connections): connection card with connect/sync/disconnect actions"
```

---

## Task 4: Surface from v2 settings (and home)

**Files:**
- Modify: `src/app/v2/settings/page.tsx` (add a card linking to `/v2/connections`)
- Modify: `src/app/v2/settings/_components/LegacyLinksCard.tsx` (downgrade the legacy `/settings#integrations` link to a footnote since v2 now owns this surface)

**Step 1: Add the link card in settings**

Find the existing settings page and add (or modify the `LegacyLinksCard`) so it leads with:

```typescript
<Card padding="md">
  <h3 style={{ margin: 0, fontSize: 'var(--v2-text-base)', fontWeight: 'var(--v2-weight-semibold)' }}>
    Connect your health
  </h3>
  <p style={{
    margin: '4px 0 12px 0',
    fontSize: 'var(--v2-text-sm)',
    color: 'var(--v2-text-secondary)',
    lineHeight: 'var(--v2-leading-relaxed)',
  }}>
    Wearables, patient portals, and lab emails in one place.
  </p>
  <Link href="/v2/connections" style={{
    fontSize: 'var(--v2-text-sm)',
    color: 'var(--v2-text-primary)',
    textDecoration: 'underline',
  }}>Open Connections</Link>
</Card>
```

**Step 2: Smoke-test the link in browser dev**

Run: `curl -s -H "Cookie: lh_session=debug" http://localhost:3005/v2/settings | grep -c "/v2/connections"`
Expected: at least 1.

**Step 3: Commit**

```bash
git add src/app/v2/settings/
git commit -m "feat(v2/settings): surface Connections page entry point"
```

---

## Task 5: E2E test

**Files:**
- Create: `tests/e2e/v2-connections.spec.ts`

**Step 1: Write the test**

```typescript
import { expect, test } from '@playwright/test'

test.setTimeout(120_000)

test('v2 connections page renders the supported sources', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/v2/connections', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('h1:has-text("Connections")', { timeout: 60_000 })

  // Page contains a tile that links to file import as the always-on fallback
  await expect(page.getByRole('link', { name: /open file import/i })).toBeVisible()

  // No horizontal overflow at iPhone Pro width
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  expect(fits).toBe(true)
})

test('v2 settings links to the connections page', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/v2/settings', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('link', { name: /open connections/i })).toBeVisible()
})
```

**Step 2: Run it**

Run: `PLAYWRIGHT_BASE_URL=http://localhost:3005 npx playwright test tests/e2e/v2-connections.spec.ts --project=mobile-chrome --reporter=list`
Expected: 2 passed.

**Step 3: Commit**

```bash
git add tests/e2e/v2-connections.spec.ts
git commit -m "test(e2e): /v2/connections renders + settings links to it"
```

---

## Task 6: Push + open PR

```bash
git push
gh pr create --title "feat(v2): Connections page surfaces every integration in one place" \
  --body "Phase 1 of the medical-data-aggregation plan. ..."
```

PR body templated from the design doc + changelog of the commits in this branch.

---

## Out of scope (Phase 2+)

- `HKClinicalRecord` reads (Phase 2 design)
- Email-ingest pipeline (Phase 3)
- AI text/photo capture (Phase 4)
- Aggregator (Phase 5)
- Provider directory (Phase 7)

If a task in this plan reveals a missing primitive in `src/v2/components/primitives/`, file a FOUNDATION-REQUEST PR instead of editing the primitive directly.
