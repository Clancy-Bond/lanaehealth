'use client'

/**
 * CookieConsentBanner
 *
 * One-shot, dismissable footer banner that informs the user we use
 * only essential cookies. Shown on the first visit and never again
 * once the user clicks "Got it" (or visits any page after the
 * acknowledgement is recorded).
 *
 * Implementation notes:
 *
 *  - Storage is local-storage so it survives across sub-domain hops
 *    in the same browser. Key: `v2-cookie-consent` (documented in
 *    /v2/legal/cookie-policy).
 *  - Reads happen client-side only; the server can't see local
 *    storage so the banner is rendered hidden until the effect runs.
 *    This avoids a hydration mismatch and a flash of the banner for
 *    returning users.
 *  - Foundation primitives only (Button, Card). NC voice.
 *  - We never track whether the banner was shown; the server has no
 *    record. The banner is informational, not a consent gate
 *    (essential cookies do not require GDPR consent per Recital 32).
 */
import { useCallback, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Button } from '@/v2/components/primitives'

const STORAGE_KEY = 'v2-cookie-consent'
const STORAGE_VALUE = 'acknowledged'

// Subscribe-to-storage event so multiple tabs stay in sync. Returning
// a no-op subscribe is fine in tests where window is unavailable.
function subscribeToStorage(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  window.addEventListener('storage', onStoreChange)
  return () => window.removeEventListener('storage', onStoreChange)
}

function readAcknowledged(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(STORAGE_KEY) === STORAGE_VALUE
  } catch {
    // Storage is blocked (private mode in some browsers). Treat as
    // acknowledged so we don't pester the user on every page load.
    return true
  }
}

// Server-side and pre-hydration snapshot: render nothing. The banner
// flips on (only if needed) once useSyncExternalStore reads from the
// real storage on the client.
const SERVER_SNAPSHOT = true

export default function CookieConsentBanner() {
  const acknowledged = useSyncExternalStore(
    subscribeToStorage,
    readAcknowledged,
    () => SERVER_SNAPSHOT,
  )

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, STORAGE_VALUE)
      // setItem doesn't fire the `storage` event in the same tab.
      // Dispatch one manually so useSyncExternalStore re-reads.
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
    } catch {
      // Storage blocked - we cannot remember the dismissal but
      // hiding for the rest of this page load is still nice.
    }
  }, [])

  if (acknowledged) return null

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      style={{
        position: 'fixed',
        // Sit above the bottom tab bar so we are never covered.
        bottom: 'calc(var(--v2-tabbar-height) + var(--v2-safe-bottom) + var(--v2-space-3))',
        left: 'var(--v2-space-3)',
        right: 'var(--v2-space-3)',
        zIndex: 50,
        background: 'var(--v2-bg-elevated)',
        color: 'var(--v2-text-primary)',
        border: '1px solid var(--v2-border-strong)',
        borderRadius: 'var(--v2-radius-lg)',
        boxShadow: 'var(--v2-shadow-md)',
        padding: 'var(--v2-space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-3)',
        maxWidth: 520,
        marginLeft: 'auto',
        marginRight: 'auto',
        // No entry animation: tokens.css owns keyframes and we
        // cannot register a new one from a primitive without a
        // FOUNDATION-REQUEST. The banner is rare enough (first
        // visit only) that a static reveal is fine.
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-sm)',
          lineHeight: 'var(--v2-leading-relaxed)',
        }}
      >
        We use only essential cookies to keep you signed in and remember your
        preferences. No tracking, no advertising, no third-party analytics.
      </p>
      <div
        style={{
          display: 'flex',
          gap: 'var(--v2-space-2)',
          alignItems: 'center',
          justifyContent: 'flex-end',
          flexWrap: 'wrap',
        }}
      >
        <Link
          href="/v2/legal/cookie-policy"
          prefetch={false}
          style={{
            color: 'var(--v2-text-secondary)',
            textDecoration: 'none',
            fontSize: 'var(--v2-text-sm)',
            fontWeight: 'var(--v2-weight-semibold)',
            padding: 'var(--v2-space-2) var(--v2-space-3)',
          }}
        >
          Read policy
        </Link>
        <Button variant="primary" size="sm" onClick={dismiss}>
          Got it
        </Button>
      </div>
    </div>
  )
}
