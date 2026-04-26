'use client'

/**
 * PasskeySignInButton
 *
 * Triggers WebAuthn authentication. Browser shows the OS passkey
 * picker (Face ID / Touch ID on iOS / macOS, Windows Hello on
 * Windows, fingerprint on Android). On success we POST the assertion
 * to /api/auth/passkey/authenticate which verifies it against the
 * stored credential and exchanges it for a Supabase session.
 *
 * The button is hidden if the browser does not support WebAuthn.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { startAuthentication } from '@simplewebauthn/browser'

export interface PasskeySignInButtonProps {
  redirectTo: string
  onError?: (message: string) => void
}

export default function PasskeySignInButton({ redirectTo, onError }: PasskeySignInButtonProps) {
  const router = useRouter()
  const [supported, setSupported] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined')
  }, [])

  if (!supported) return null

  async function onClick() {
    if (busy) return
    setBusy(true)
    try {
      const optionsRes = await fetch('/api/auth/passkey/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: 'options' }),
      })
      if (!optionsRes.ok) {
        const body = (await optionsRes.json().catch(() => null)) as { error?: string } | null
        onError?.(body?.error ?? 'No passkey is registered for this device. Sign in another way and add one in Settings.')
        setBusy(false)
        return
      }
      const { options } = (await optionsRes.json()) as { options: Parameters<typeof startAuthentication>[0]['optionsJSON'] }

      let assertion
      try {
        assertion = await startAuthentication({ optionsJSON: options })
      } catch (err) {
        onError?.(err instanceof Error && err.name === 'NotAllowedError'
          ? 'No passkey was used. You can try again or sign in another way.'
          : `Passkey sign-in did not finish. ${err instanceof Error ? err.message : ''}`)
        setBusy(false)
        return
      }

      const verifyRes = await fetch('/api/auth/passkey/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: 'verify', assertion }),
      })
      if (!verifyRes.ok) {
        const body = (await verifyRes.json().catch(() => null)) as { error?: string } | null
        onError?.(body?.error ?? 'Passkey could not be verified.')
        setBusy(false)
        return
      }
      router.push(redirectTo)
      router.refresh()
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Network error.')
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="v2-btn-press"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--v2-space-2)',
        width: '100%',
        minHeight: 44,
        padding: '0 var(--v2-space-5)',
        fontSize: 'var(--v2-text-base)',
        fontWeight: 'var(--v2-weight-semibold)',
        borderRadius: 'var(--v2-radius-full)',
        background: 'transparent',
        color: 'var(--v2-text-primary)',
        border: '1px solid var(--v2-border-strong)',
        cursor: busy ? 'not-allowed' : 'pointer',
        opacity: busy ? 0.6 : 1,
        fontFamily: 'inherit',
        transition: 'opacity var(--v2-duration-fast) var(--v2-ease-standard)',
      }}
      aria-label="Use a passkey"
    >
      <PasskeyIcon />
      <span>{busy ? 'Asking your device' + '…' : 'Use a passkey'}</span>
    </button>
  )
}

function PasskeyIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="9" cy="9" r="3" />
      <path d="M9 12c-2.5 0-5 1.5-5 4v1h7" />
      <path d="M14 14l3 3 4-4" />
      <path d="M21 12a3 3 0 0 0-6 0v3h6v-3z" transform="translate(-4 0)" />
    </svg>
  )
}
