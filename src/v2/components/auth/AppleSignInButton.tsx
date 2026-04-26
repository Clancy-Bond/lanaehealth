'use client'

/**
 * AppleSignInButton
 *
 * iOS-style "Continue with Apple" button. Black fill, white Apple
 * mark, exactly per Apple's brand guidelines. Calls Supabase OAuth
 * with provider='apple' which redirects the browser to Apple's
 * Sign In with Apple flow, then back to /auth/callback on return.
 *
 * If Apple credentials are not yet configured in the Supabase
 * project, the redirect throws a useful error which we surface in
 * NC voice.
 */
import { useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/auth/supabase-browser'

export interface AppleSignInButtonProps {
  redirectTo?: string
  onError?: (message: string) => void
}

export default function AppleSignInButton({ redirectTo, onError }: AppleSignInButtonProps) {
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
        provider: 'apple',
        options: {
          redirectTo: callback.toString(),
        },
      })
      if (error) {
        onError?.(formatProviderError('Apple', error.message))
        setBusy(false)
      }
      // On success the browser navigates away to Apple. We leave
      // busy=true so the button stays in its loading state until the
      // tab unloads.
    } catch (err) {
      onError?.(formatProviderError('Apple', err instanceof Error ? err.message : 'unknown error'))
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
        background: '#000000',
        color: '#FFFFFF',
        border: '1px solid #000000',
        cursor: busy ? 'not-allowed' : 'pointer',
        opacity: busy ? 0.6 : 1,
        fontFamily: 'inherit',
        transition: 'opacity var(--v2-duration-fast) var(--v2-ease-standard)',
      }}
      aria-label="Continue with Apple"
    >
      <AppleMark />
      <span>Continue with Apple</span>
    </button>
  )
}

function AppleMark() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.5-.12-1.07.396-2.2 1.10-2.94.794-.84 2.085-1.46 2.998-1.5.04.13.066.26.066.39.001.16-.001-.16 0-.53zM21 17.55c-.79 1.81-1.17 2.62-2.18 4.22-1.42 2.23-3.42 5.01-5.9 5.04-2.2.02-2.77-1.44-5.77-1.42-3 .02-3.62 1.45-5.83 1.43-2.48-.04-4.36-2.55-5.78-4.78C-.97 17.5-.16 12.05 2.5 9.39c1.86-1.85 4.23-2.93 6.46-2.93 2.27 0 3.7 1.25 5.59 1.25 1.83 0 2.95-1.25 5.58-1.25 2 0 4.13 1.09 5.65 2.97-4.96 2.72-4.16 9.81-4.78 8.12z"
        fill="#FFFFFF"
        transform="translate(0,-2.5) scale(0.95)"
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
