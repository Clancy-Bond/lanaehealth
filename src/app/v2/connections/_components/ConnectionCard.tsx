'use client'

/*
 * ConnectionCard
 *
 * One row per registered integration. Shows status, source description,
 * and the right action for the current state:
 *   - disconnected → Connect
 *   - connected    → Sync · Disconnect
 *   - expired      → Reconnect
 *
 * Wires straight to the existing /api/integrations/{id}/{authorize,
 * sync,disconnect} endpoints. No new server logic.
 */

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
  expired: boolean
  lastActivityAt: string | null
  expiresAt: string | null
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'never'
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms) || ms < 0) return 'just now'
  const min = Math.round(ms / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.round(hr / 24)
  return `${d}d ago`
}

interface Props {
  row: StatusRow
}

export default function ConnectionCard({ row }: Props) {
  const [busy, setBusy] = useState<'sync' | 'disconnect' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(row.connected)
  const [expired, setExpired] = useState(row.expired)
  const [lastActivityAt, setLastActivityAt] = useState(row.lastActivityAt)

  function startConnect() {
    window.location.href = `/api/integrations/${row.id}/authorize`
  }

  async function runSync() {
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
        setLastActivityAt(new Date().toISOString())
      }
    } catch {
      setError('Sync failed. Try again in a moment.')
    } finally {
      setBusy(null)
    }
  }

  async function runDisconnect() {
    if (!confirm(`Disconnect ${row.name}? We keep the data already imported.`)) return
    setBusy('disconnect')
    try {
      await fetch(`/api/integrations/${row.id}/disconnect`, { method: 'POST' })
      setConnected(false)
      setExpired(false)
      setLastActivityAt(null)
    } catch {
      setError('Disconnect failed.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card padding="md">
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--v2-space-3)',
        }}
      >
        <div
          aria-hidden
          style={{
            width: 44,
            height: 44,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--v2-bg-elevated)',
            borderRadius: 'var(--v2-radius-md)',
            fontSize: 22,
          }}
        >
          {row.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 'var(--v2-space-2)',
              flexWrap: 'wrap',
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-sm)',
                fontWeight: 'var(--v2-weight-semibold)',
                color: 'var(--v2-text-primary)',
                minWidth: 0,
                overflowWrap: 'anywhere',
              }}
            >
              {row.name}
            </h3>
            {connected && (
              <span
                style={{
                  fontSize: 'var(--v2-text-xs)',
                  color: 'var(--v2-text-muted)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                synced {relativeTime(lastActivityAt)}
              </span>
            )}
            {expired && (
              <span
                style={{
                  fontSize: 'var(--v2-text-xs)',
                  color: 'var(--v2-accent-warning)',
                  fontWeight: 'var(--v2-weight-semibold)',
                }}
              >
                reconnect needed
              </span>
            )}
          </div>
          <p
            style={{
              margin: '2px 0 0 0',
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            {row.description}
          </p>
          {error && (
            <p
              style={{
                margin: '6px 0 0 0',
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-accent-danger)',
              }}
            >
              {error}
            </p>
          )}
        </div>

        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            gap: 'var(--v2-space-2)',
          }}
        >
          {!connected ? (
            <Button variant="secondary" size="sm" onClick={startConnect}>
              {expired ? 'Reconnect' : 'Connect'}
            </Button>
          ) : (
            <>
              <Button
                variant="tertiary"
                size="sm"
                onClick={runSync}
                disabled={busy !== null}
              >
                {busy === 'sync' ? 'Syncing' : 'Sync'}
              </Button>
              <Button
                variant="tertiary"
                size="sm"
                onClick={runDisconnect}
                disabled={busy !== null}
                aria-label={`Disconnect ${row.name}`}
              >
                ×
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}
