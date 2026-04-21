'use client'

/*
 * OuraStatusCard
 *
 * Shows connection state + last sync time for the Oura Ring and
 * offers the two actions the user reaches for most:
 *   - Sync now: POST /api/oura/sync with a 30-day window
 *   - Disconnect: POST /api/oura/disconnect
 *
 * Both endpoints are unauthenticated in this app, same as the
 * legacy OuraSection handles them. On sync we reload the page so
 * the server-rendered "Last synced" copy refreshes from the DB;
 * on disconnect we reload for the same reason. Loading and error
 * states stay in-component so the refresh is the only navigation.
 *
 * When not connected we link out to legacy /settings#oura: the
 * OAuth authorize flow lives there and is a desktop-first
 * experience.
 */
import { useState } from 'react'
import Link from 'next/link'
import { Button, Card } from '@/v2/components/primitives'

export interface OuraStatusCardProps {
  connected: boolean
  lastSyncTime: string | null
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'never'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'recently'
  const diffMs = Date.now() - then
  if (diffMs < 0) return 'just now'

  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`

  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`

  const years = Math.floor(months / 12)
  return `${years} year${years === 1 ? '' : 's'} ago`
}

export default function OuraStatusCard({
  connected,
  lastSyncTime,
}: OuraStatusCardProps) {
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSync() {
    setSyncing(true)
    setError(null)
    try {
      const now = new Date()
      const end = now.toISOString().slice(0, 10)
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10)

      const res = await fetch('/api/oura/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: start, end_date: end }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Sync failed (${res.status})`)
      }
      // Fresh server-rendered "Last synced" copy after the write.
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed. Try again?')
      setSyncing(false)
    }
  }

  async function handleDisconnect() {
    const ok = window.confirm(
      'Disconnect your Oura Ring? You can reconnect anytime from legacy settings.',
    )
    if (!ok) return
    setDisconnecting(true)
    setError(null)
    try {
      const res = await fetch('/api/oura/disconnect', { method: 'POST' })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Disconnect failed (${res.status})`)
      }
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disconnect failed. Try again?')
      setDisconnecting(false)
    }
  }

  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
        <div>
          <h2
            style={{
              fontSize: 'var(--v2-text-lg)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
              margin: 0,
            }}
          >
            Oura
          </h2>
          <p
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-muted)',
              marginTop: 'var(--v2-space-1)',
              marginBottom: 0,
            }}
          >
            {connected
              ? `Last synced: ${formatRelativeTime(lastSyncTime)}.`
              : 'Not connected.'}
          </p>
        </div>

        {connected ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--v2-space-2)',
            }}
          >
            <Button
              variant="primary"
              onClick={handleSync}
              disabled={syncing || disconnecting}
            >
              {syncing ? 'Syncing' : 'Sync now'}
            </Button>
            <Button
              variant="tertiary"
              onClick={handleDisconnect}
              disabled={syncing || disconnecting}
            >
              {disconnecting ? 'Disconnecting' : 'Disconnect'}
            </Button>
          </div>
        ) : (
          <div>
            <Link href="/settings#oura" style={{ textDecoration: 'none' }}>
              <Button variant="primary">Connect Oura</Button>
            </Link>
          </div>
        )}

        {error && (
          <p
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-accent-danger)',
              margin: 0,
            }}
          >
            {error}
          </p>
        )}
      </div>
    </Card>
  )
}
