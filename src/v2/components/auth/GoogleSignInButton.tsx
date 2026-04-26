'use client'

/**
 * GoogleSignInButton
 *
 * Google brand-compliant "Continue with Google" button. White fill,
 * grey border, multi-color G mark per Google's branding guide.
 * Calls Supabase OAuth with provider='google' which redirects the
 * browser to Google's consent screen, then back to /auth/callback.
 *
 * If Google credentials are not configured in Supabase the redirect
 * throws and we surface the error in NC voice.
 */
import { useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/auth/supabase-browser'

export interface GoogleSignInButtonProps {
  redirectTo?: string
  onError?: (message: string) => void
}

export default function GoogleSignInButton({ redirectTo, onError }: GoogleSignInButtonProps) {
  const [busy, setBusy] = useState(false)

  async function onClick() {
    if (busy) return
    setBusy(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ??
        (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3005')
      const callback = new URL('/auth/callback', appUrl)
      if (redirectTo) callback.searchParams.set('redirectTo', redirectTo)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callback.toString(),
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
      if (error) {
        onError?.(formatProviderError('Google', error.message))
        setBusy(false)
      }
    } catch (err) {
      onError?.(formatProviderError('Google', err instanceof Error ? err.message : 'unknown error'))
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
        background: '#FFFFFF',
        color: '#1F1F1F',
        border: '1px solid #DADCE0',
        cursor: busy ? 'not-allowed' : 'pointer',
        opacity: busy ? 0.6 : 1,
        fontFamily: 'inherit',
        transition: 'opacity var(--v2-duration-fast) var(--v2-ease-standard)',
      }}
      aria-label="Continue with Google"
    >
      <GoogleMark />
      <span>Continue with Google</span>
    </button>
  )
}

function GoogleMark() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.169.282-1.706V4.962H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  )
}

function formatProviderError(provider: string, raw: string): string {
  const lower = raw.toLowerCase()
  if (lower.includes('provider is not enabled') || lower.includes('not enabled') || lower.includes('disabled')) {
    return `${provider} sign-in is not configured yet. We will turn it on as soon as the credentials are in place.`
  }
  if (lower.includes('redirect') && lower.includes('not allowed')) {
    return `${provider} sign-in needs a small config tweak before it can run here. Try email and password for now.`
  }
  return `${provider} sign-in did not start. ${raw}`
}
