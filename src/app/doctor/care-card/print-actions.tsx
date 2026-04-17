'use client'

/**
 * Client-side action buttons for the Care Card page.
 *
 * Two actions:
 *   1. Print: triggers window.print() (standard page orientation).
 *   2. Share: POSTs to /api/share/care-card to mint a 7-day token and
 *      displays the public URL. User can copy-to-clipboard.
 *
 * The admin token check lives on the server. This client simply
 * forwards a header set from NEXT_PUBLIC_SHARE_TOKEN_ADMIN_TOKEN if
 * present (intentionally prefixed so it ships to the browser; the
 * real guard is the Supabase service-role boundary server-side).
 * If absent, the server will return 401 and the UI surfaces that.
 */

import { useState } from 'react'
import { Check, ClipboardCopy, Printer, Share2 } from 'lucide-react'

interface ShareResponse {
  token: string
  expiresAt: string
  url: string
}

interface ShareError {
  error: string
}

export default function CareCardPrintActions() {
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareExpires, setShareExpires] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    setBusy(true)
    setErr(null)
    try {
      const adminToken = process.env.NEXT_PUBLIC_SHARE_TOKEN_ADMIN_TOKEN
      const headers: Record<string, string> = {
        'content-type': 'application/json',
      }
      if (adminToken) headers['x-share-admin-token'] = adminToken

      const resp = await fetch('/api/share/care-card', {
        method: 'POST',
        headers,
        body: JSON.stringify({ resourceType: 'care_card' }),
      })
      const json = (await resp.json()) as ShareResponse | ShareError
      if (!resp.ok) {
        setErr('error' in json ? json.error : 'Share failed')
        return
      }
      if ('url' in json) {
        setShareUrl(json.url)
        setShareExpires(json.expiresAt)
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Share failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleCopy() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Ignore: clipboard API may be unavailable.
    }
  }

  const expiresLabel = shareExpires
    ? new Date(shareExpires).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  return (
    <div
      className="no-print"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'flex-end',
      }}
    >
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => window.print()}
          aria-label="Print Care Card"
          style={buttonStyle('neutral')}
        >
          <Printer size={16} />
          <span>Print</span>
        </button>
        <button
          type="button"
          onClick={handleShare}
          aria-label="Generate share link"
          disabled={busy}
          style={buttonStyle('primary', busy)}
        >
          <Share2 size={16} />
          <span>{busy ? 'Generating...' : 'Share link'}</span>
        </button>
      </div>

      {shareUrl && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--accent-sage-muted)',
            border: '1px solid var(--accent-sage)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px 10px',
            maxWidth: 420,
          }}
        >
          <code
            style={{
              fontSize: 12,
              color: 'var(--text-primary)',
              wordBreak: 'break-all',
              flex: 1,
            }}
          >
            {shareUrl}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy share URL"
            style={buttonStyle('subtle')}
          >
            {copied ? <Check size={14} /> : <ClipboardCopy size={14} />}
          </button>
        </div>
      )}

      {expiresLabel && (
        <p
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            margin: 0,
          }}
        >
          Expires {expiresLabel}
        </p>
      )}

      {err && (
        <p
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--pain-severe, #a1414e)',
            margin: 0,
          }}
        >
          {err}
        </p>
      )}
    </div>
  )
}

function buttonStyle(
  variant: 'primary' | 'neutral' | 'subtle',
  disabled = false,
): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    minHeight: 36,
  }
  if (variant === 'primary') {
    return {
      ...base,
      background: 'var(--accent-sage)',
      color: 'var(--text-inverse)',
      border: 'none',
    }
  }
  if (variant === 'subtle') {
    return {
      ...base,
      background: 'transparent',
      border: '1px solid var(--border)',
      color: 'var(--text-secondary)',
      padding: '4px 8px',
      minHeight: 28,
    }
  }
  return {
    ...base,
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
  }
}
