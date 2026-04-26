'use client'

/*
 * DataExportCard
 *
 * Drives the v2 data export flow:
 *   1. Lists every PHI category that will be in the ZIP, with a short
 *      one-line description per table. The catalog is rendered server-side
 *      so the user sees the full inventory before they tap.
 *   2. Tap "Download all my data" to POST /api/v2/data-export/request.
 *      The button shows a progress state ("Building your export...") and
 *      then triggers a browser download of the returned ZIP.
 *   3. If the user has exported in the last 24h, surfaces the timestamp
 *      and the "next available at" hint.
 *
 * NC voice everywhere: short, kind, explanatory.
 */
import { useState } from 'react'
import { Card, Button, ListRow, Banner } from '@/v2/components/primitives'

export interface ExportCatalogTable {
  name: string
  format: 'csv' | 'json'
  description: string
}

export interface ExportCatalogEntry {
  category: string
  tables: ExportCatalogTable[]
}

export interface LastExportInfo {
  requestedAt: string
  completedAt: string | null
  fileSizeBytes: number | null
  status: 'pending' | 'completed' | 'failed'
}

export interface DataExportCardProps {
  catalog: ExportCatalogEntry[]
  lastExport: LastExportInfo | null
  authed: boolean
}

type DownloadState =
  | { kind: 'idle' }
  | { kind: 'building' }
  | { kind: 'downloading'; bytes: number }
  | { kind: 'done'; filename: string; bytes: number }
  | { kind: 'error'; message: string }

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffMs = now - then
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function nextAvailableAt(iso: string): string | null {
  const then = new Date(iso).getTime()
  const next = new Date(then + 24 * 60 * 60 * 1000)
  if (next.getTime() <= Date.now()) return null
  // Show local time so the user can plan around it.
  try {
    return next.toLocaleString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return next.toISOString()
  }
}

export default function DataExportCard({ catalog, lastExport, authed }: DataExportCardProps) {
  const [state, setState] = useState<DownloadState>({ kind: 'idle' })
  const [emailWhenReady, setEmailWhenReady] = useState(false)

  const isBusy = state.kind === 'building' || state.kind === 'downloading'
  const nextAt = lastExport && lastExport.status !== 'failed' ? nextAvailableAt(lastExport.requestedAt) : null
  const dailyLimitHit = !!nextAt

  async function startDownload() {
    if (isBusy || dailyLimitHit) return
    setState({ kind: 'building' })
    try {
      const res = await fetch('/api/v2/data-export/request', { method: 'POST' })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        if (res.status === 429) {
          setState({
            kind: 'error',
            message: body?.error ?? 'You can request one full export per day. Please try again tomorrow.',
          })
          return
        }
        setState({
          kind: 'error',
          message: body?.error ?? `Export failed (${res.status}). Please try again.`,
        })
        return
      }

      // Read the body as a Blob so we can hand it to the browser as a
      // download. We do not stream because the server already buffers
      // the full ZIP; streaming wouldn't help here.
      setState({ kind: 'downloading', bytes: 0 })
      const blob = await res.blob()
      const filename =
        parseFilename(res.headers.get('content-disposition')) ??
        `lanaehealth-export-${new Date().toISOString().slice(0, 10)}.zip`

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setState({ kind: 'done', filename, bytes: blob.size })
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error. Please try again.',
      })
    }
  }

  return (
    <>
      <Card data-testid="data-export-card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
          <h2
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-lg)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
            }}
          >
            Build my export
          </h2>

          {!authed && (
            <Banner intent="info" title="Please log in to download your data." />
          )}

          {state.kind === 'error' && (
            <div data-testid="data-export-error">
              <Banner intent="danger" title="Export could not start" body={state.message} />
            </div>
          )}

          {state.kind === 'done' && (
            <div data-testid="data-export-success">
              <Banner
                intent="success"
                title="Your export downloaded"
                body={`${state.filename} (${formatBytes(state.bytes)}). Check your downloads folder.`}
              />
            </div>
          )}

          {dailyLimitHit && nextAt && (
            <Banner
              intent="info"
              title="You can request the next export tomorrow"
              body={`You exported ${formatRelative(lastExport!.requestedAt)}. The next export is available at ${nextAt}.`}
            />
          )}

          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={startDownload}
            disabled={!authed || isBusy || dailyLimitHit}
            data-testid="data-export-download-button"
          >
            {state.kind === 'building'
              ? 'Building your export...'
              : state.kind === 'downloading'
                ? 'Downloading...'
                : 'Download all my data'}
          </Button>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--v2-space-2)',
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-muted)',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={emailWhenReady}
              onChange={(e) => setEmailWhenReady(e.target.checked)}
              disabled={isBusy}
            />
            Email me when the export is ready (optional, requires email setup)
          </label>

          {lastExport && lastExport.status === 'completed' && (
            <p
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-text-muted)',
              }}
            >
              Last successful export: {formatRelative(lastExport.completedAt ?? lastExport.requestedAt)}
              {lastExport.fileSizeBytes ? ` (${formatBytes(lastExport.fileSizeBytes)})` : ''}.
            </p>
          )}
        </div>
      </Card>

      <Card data-testid="data-export-catalog">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
          <h2
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-lg)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
            }}
          >
            What is included
          </h2>
          {catalog.map((entry, idx) => (
            <div key={entry.category} style={{ display: 'flex', flexDirection: 'column' }}>
              <h3
                style={{
                  margin: 0,
                  marginTop: idx === 0 ? 0 : 'var(--v2-space-2)',
                  marginBottom: 'var(--v2-space-1)',
                  fontSize: 'var(--v2-text-sm)',
                  fontWeight: 'var(--v2-weight-semibold)',
                  color: 'var(--v2-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {entry.category}
              </h3>
              <div>
                {entry.tables.map((t, tIdx) => (
                  <ListRow
                    key={t.name}
                    label={t.name}
                    subtext={t.description}
                    trailing={
                      <span
                        style={{
                          fontSize: 'var(--v2-text-xs)',
                          fontWeight: 'var(--v2-weight-semibold)',
                          color: 'var(--v2-text-muted)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {t.format}
                      </span>
                    }
                    divider={tIdx < entry.tables.length - 1}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}

function parseFilename(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null
  const match = contentDisposition.match(/filename="?([^";]+)"?/i)
  return match ? match[1] : null
}
