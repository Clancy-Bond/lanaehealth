'use client'

/**
 * HealthKitSyncCard
 *
 * Settings-page card that ONLY renders when the app is running inside
 * the Capacitor iOS shell. In a regular browser the component returns
 * null so the card disappears entirely (no confusing "install our app
 * to enable this" copy in the desktop / mobile-Safari views).
 *
 * Two states:
 *   1. Not yet authorized → primary button "Connect Apple Health"
 *      → triggers the capacitor-health auth prompt → on grant, runs
 *         an immediate 30-day backfill so cycle / weight / BP / HR
 *         show up right away.
 *   2. Authorized → "Last synced N min ago" + "Sync now" button.
 *
 * The actual capacitor-health calls are loaded dynamically because
 * the plugin pulls in iOS-only native bindings the browser bundle
 * does not need; importing it eagerly bloats the chunk and can crash
 * Webpack on the server build.
 */
import { useEffect, useState } from 'react'
import { Card } from '@/v2/components/primitives'
import {
  HEALTHKIT_READ_TYPES,
  isHealthKitAvailable,
  type HealthKitSample,
  type HealthKitTypeIdentifier,
} from '@/lib/capacitor/runtime'

interface SyncState {
  authorized: boolean
  lastSyncedAt: string | null
  busy: boolean
  message: string | null
  error: string | null
}

const INITIAL: SyncState = {
  authorized: false,
  lastSyncedAt: null,
  busy: false,
  message: null,
  error: null,
}

export default function HealthKitSyncCard() {
  const [available, setAvailable] = useState(false)
  const [state, setState] = useState<SyncState>(INITIAL)

  useEffect(() => {
    setAvailable(isHealthKitAvailable())
    // Hydrate the lastSyncedAt from localStorage so the card shows
    // honest history across app restarts.
    try {
      const stored = window.localStorage.getItem('lh.healthkit.lastSyncedAt')
      if (stored) setState((s) => ({ ...s, lastSyncedAt: stored }))
    } catch {
      /* private mode */
    }
  }, [])

  if (!available) return null

  async function connect() {
    setState((s) => ({ ...s, busy: true, error: null, message: 'Asking iOS for permission…' }))
    try {
      const health = await loadHealthPlugin()
      const auth = await health.requestHealthAuthorization({
        read: [...HEALTHKIT_READ_TYPES],
        write: [],
      })
      if (auth?.granted === false) {
        setState({
          ...INITIAL,
          error:
            'Apple Health permission was declined. Open iOS Settings → Health → Data Access & Devices → LanaeHealth to grant it.',
        })
        return
      }
      setState((s) => ({ ...s, authorized: true, message: 'Connected. Syncing the last 30 days…' }))
      await runSync(30)
    } catch (err) {
      setState({
        ...INITIAL,
        error: err instanceof Error ? err.message : 'Could not connect to Apple Health.',
      })
    }
  }

  async function syncNow() {
    setState((s) => ({ ...s, busy: true, error: null, message: 'Pulling samples from Apple Health…' }))
    try {
      await runSync(7)
    } catch (err) {
      setState((s) => ({
        ...s,
        busy: false,
        error: err instanceof Error ? err.message : 'Sync failed.',
      }))
    }
  }

  async function runSync(daysBack: number) {
    const health = await loadHealthPlugin()
    const end = new Date()
    const start = new Date(end.getTime() - daysBack * 86_400_000)
    const samples: HealthKitSample[] = []

    for (const id of HEALTHKIT_READ_TYPES) {
      try {
        const result = await health.queryHKitSampleType({
          sampleName: id,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          limit: 5000,
        })
        if (result?.resultData && Array.isArray(result.resultData)) {
          for (const r of result.resultData) {
            samples.push(normalize(id, r))
          }
        }
      } catch {
        // Per-identifier failure is non-fatal; some are not supported
        // on every iOS version (e.g. ovulation). Skip and move on.
        continue
      }
    }

    const resp = await fetch('/api/healthkit/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        synced_for_date: end.toISOString().slice(0, 10),
        captured_at: new Date().toISOString(),
        samples,
      }),
    })
    if (!resp.ok) {
      const body = (await resp.json().catch(() => ({}))) as { error?: string }
      setState((s) => ({
        ...s,
        busy: false,
        error: body.error ?? `Server returned ${resp.status}`,
      }))
      return
    }
    const data = (await resp.json()) as {
      ok: boolean
      days_processed?: number
      sample_count?: number
    }
    const stamp = new Date().toISOString()
    try {
      window.localStorage.setItem('lh.healthkit.lastSyncedAt', stamp)
    } catch {
      /* private mode */
    }
    setState({
      authorized: true,
      lastSyncedAt: stamp,
      busy: false,
      message: `Pulled ${data.sample_count ?? samples.length} samples across ${data.days_processed ?? 0} days.`,
      error: null,
    })
  }

  return (
    <Card padding="md" aria-label="Apple Health sync">
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 'var(--v2-space-2)',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-base)',
            fontWeight: 'var(--v2-weight-semibold)',
            color: 'var(--v2-text-primary)',
          }}
        >
          Apple Health
        </h3>
        {state.lastSyncedAt && (
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            Synced {formatRelative(state.lastSyncedAt)}
          </span>
        )}
      </div>

      <p
        style={{
          margin: '0 0 var(--v2-space-3) 0',
          fontSize: 'var(--v2-text-sm)',
          color: 'var(--v2-text-secondary)',
          lineHeight: 1.5,
        }}
      >
        Auto-import cycle / period, weight, BP, HR, and BBT from Apple Health so you do not have to
        log them twice.
      </p>

      {state.message && !state.error && (
        <p
          role="status"
          style={{
            margin: '0 0 var(--v2-space-2) 0',
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-secondary)',
          }}
        >
          {state.message}
        </p>
      )}
      {state.error && (
        <p
          role="alert"
          style={{
            margin: '0 0 var(--v2-space-2) 0',
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-accent-danger)',
          }}
        >
          {state.error}
        </p>
      )}

      <button
        type="button"
        onClick={state.authorized ? syncNow : connect}
        disabled={state.busy}
        style={{
          appearance: 'none',
          border: 'none',
          background: 'var(--v2-accent-primary)',
          color: 'var(--v2-on-accent)',
          padding: 'var(--v2-space-2) var(--v2-space-4)',
          borderRadius: 'var(--v2-radius-full)',
          fontFamily: 'inherit',
          fontSize: 'var(--v2-text-sm)',
          fontWeight: 'var(--v2-weight-semibold)',
          cursor: state.busy ? 'progress' : 'pointer',
          minHeight: 'var(--v2-touch-target-min)',
        }}
      >
        {state.busy ? 'Working…' : state.authorized ? 'Sync now' : 'Connect Apple Health'}
      </button>
    </Card>
  )
}

// ── capacitor-health dynamic loader ────────────────────────────────

interface HealthPluginQueryResult {
  resultData?: Array<Record<string, unknown>>
}

interface HealthPluginAuthResult {
  granted?: boolean
}

interface HealthPlugin {
  requestHealthAuthorization(opts: {
    read: HealthKitTypeIdentifier[]
    write: HealthKitTypeIdentifier[]
  }): Promise<HealthPluginAuthResult>
  queryHKitSampleType(opts: {
    sampleName: HealthKitTypeIdentifier
    startDate: string
    endDate: string
    limit?: number
  }): Promise<HealthPluginQueryResult>
}

let cachedPlugin: HealthPlugin | null = null

async function loadHealthPlugin(): Promise<HealthPlugin> {
  if (cachedPlugin) return cachedPlugin
  // Dynamic import keeps the plugin out of the browser bundle.
  const mod = (await import('capacitor-health')) as unknown as {
    CapacitorHealthkit?: HealthPlugin
    Health?: HealthPlugin
  }
  const plugin = mod.CapacitorHealthkit ?? mod.Health
  if (!plugin) {
    throw new Error('capacitor-health export not found at runtime')
  }
  cachedPlugin = plugin
  return plugin
}

// ── Normalization (raw plugin JSON -> our HealthKitSample shape) ─

function normalize(
  identifier: HealthKitTypeIdentifier,
  raw: Record<string, unknown>,
): HealthKitSample {
  // capacitor-health returns Date strings on `startDate`/`endDate`
  // and a numeric value on `value`; category samples carry an
  // additional integer code field. Field names vary by plugin version
  // so we accept several common shapes.
  const start = String(raw.startDate ?? raw.start ?? raw.timestamp ?? '')
  const end = String(raw.endDate ?? raw.end ?? raw.timestamp ?? start)
  const sourceName = (raw.sourceName ?? raw.source ?? null) as string | null

  const numericValue = raw.value ?? raw.numericValue
  if (typeof numericValue === 'number') {
    return {
      identifier,
      start,
      end,
      value: numericValue,
      sourceName,
    }
  }
  // Category sample
  const code = (raw.value ?? raw.code ?? 0) as number
  const valueText = String(raw.valueText ?? raw.label ?? raw.flowLevel ?? '')
  return {
    identifier,
    start,
    end,
    code,
    valueText,
    sourceName,
  }
}

// ── Helpers ────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const minsAgo = Math.round((Date.now() - t) / 60_000)
  if (minsAgo < 1) return 'just now'
  if (minsAgo < 60) return `${minsAgo} min ago`
  const hrsAgo = Math.round(minsAgo / 60)
  if (hrsAgo < 24) return `${hrsAgo} hr ago`
  const daysAgo = Math.round(hrsAgo / 24)
  return `${daysAgo}d ago`
}
