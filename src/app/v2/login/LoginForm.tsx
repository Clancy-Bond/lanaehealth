'use client'

/**
 * Client form for /v2/login.
 *
 * Four sign-in options stacked top to bottom:
 *   1. Continue with Apple        (Supabase OAuth -> /auth/callback)
 *   2. Continue with Google       (Supabase OAuth -> /auth/callback)
 *   3. Use a passkey              (WebAuthn -> /api/auth/passkey/authenticate)
 *   4. Email + password           (POST /api/auth/v2/login)
 *
 * Voice: short, kind, explanatory. No em-dashes, no jargon.
 * Errors land as a quiet message under the form. The "?error=" query
 * param surfaces OAuth callback failures from /auth/callback.
 */
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, Button } from '@/v2/components/primitives'
import AppleSignInButton from '@/v2/components/auth/AppleSignInButton'
import GoogleSignInButton from '@/v2/components/auth/GoogleSignInButton'
import PasskeySignInButton from '@/v2/components/auth/PasskeySignInButton'

export function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const returnToRaw = params.get('returnTo')
  const returnTo = safeReturn(returnToRaw)
  const justReset = params.get('reset') === '1'
  const errorParam = params.get('error')
  // The middleware sets `returnTo` when it bounces an unauthenticated
  // request from a protected route. If the param is present at all,
  // the user is here because we sent them, not because they navigated
  // here themselves. Surface a small banner so they know why.
  const wasBounced = returnToRaw !== null && !justReset && !errorParam

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [state, setState] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState<string | null>(null)

  useEffect(() => {
    if (errorParam) setErrMsg(errorParam)
  }, [errorParam])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (state === 'submitting' || !email || !password) return
    setState('submitting')
    setErrMsg(null)
    try {
      const res = await fetch('/api/auth/v2/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        setErrMsg(mapLoginError(body?.error, res.status))
        setState('error')
        return
      }
      router.push(returnTo)
      router.refresh()
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Network error.')
      setState('error')
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--v2-bg-primary)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--v2-space-6)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
        <header style={{ textAlign: 'center' }}>
          <div
            aria-hidden
            style={{
              width: 56,
              height: 56,
              borderRadius: 'var(--v2-radius-full)',
              background: 'var(--v2-bg-elevated)',
              border: '1px solid var(--v2-border-strong)',
              margin: '0 auto var(--v2-space-3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--v2-text-primary)',
            }}
          >
            <LockIcon />
          </div>
          <p
            style={{
              fontSize: 'var(--v2-text-xs)',
              fontWeight: 'var(--v2-weight-semibold)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--v2-text-muted)',
              margin: 0,
            }}
          >
            LanaeHealth
          </p>
          <h1
            style={{
              fontSize: 'var(--v2-text-2xl)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
              margin: 'var(--v2-space-1) 0 0',
              letterSpacing: '-0.02em',
            }}
          >
            Welcome back
          </h1>
          <p
            style={{
              fontSize: 'var(--v2-text-base)',
              color: 'var(--v2-text-muted)',
              margin: 'var(--v2-space-2) 0 0',
            }}
          >
            Pick how you want to sign in. We never share your data with these providers.
          </p>
        </header>

        {justReset && (
          <Card>
            <p
              style={{
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-primary)',
                margin: 0,
              }}
            >
              Password reset email sent. Open it on this device to choose a new password.
            </p>
          </Card>
        )}

        {wasBounced && (
          <Card>
            <p
              data-testid="login-bounce-banner"
              style={{
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-primary)',
                margin: 0,
              }}
            >
              Sign in to continue to <strong>{returnTo}</strong>.
            </p>
          </Card>
        )}

        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
            <AppleSignInButton redirectTo={returnTo} onError={setErrMsg} />
            <GoogleSignInButton redirectTo={returnTo} onError={setErrMsg} />
            <PasskeySignInButton redirectTo={returnTo} onError={setErrMsg} />

            <Divider label="or" />

            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
              <Field
                label="Email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(v) => {
                  setEmail(v)
                  if (state === 'error') setState('idle')
                }}
                disabled={state === 'submitting'}
              />
              <Field
                label="Password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(v) => {
                  setPassword(v)
                  if (state === 'error') setState('idle')
                }}
                disabled={state === 'submitting'}
              />
              <Button
                type="submit"
                variant="primary"
                size="md"
                fullWidth
                disabled={state === 'submitting' || !email || !password}
              >
                {state === 'submitting' ? 'Signing in' + '…' : 'Sign in'}
              </Button>
            </form>

            {errMsg && (
              <p
                role="alert"
                style={{
                  fontSize: 'var(--v2-text-sm)',
                  color: 'var(--v2-accent-danger)',
                  margin: 0,
                }}
              >
                {errMsg}
              </p>
            )}
          </div>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)', textAlign: 'center' }}>
          <Link
            href="/v2/forgot-password"
            style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-accent-primary)', textDecoration: 'none' }}
          >
            Forgot password?
          </Link>
          <p style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-muted)', margin: 0 }}>
            New here?{' '}
            <Link
              href={`/v2/signup${returnTo !== '/v2' ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}
              style={{ color: 'var(--v2-accent-primary)', textDecoration: 'none', fontWeight: 'var(--v2-weight-semibold)' }}
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}

function safeReturn(value: string | null): string {
  if (!value || !value.startsWith('/')) return '/v2'
  if (value.startsWith('//')) return '/v2'
  return value
}

// Map a server-returned error code (or status fallback) to NC-voice
// copy. The codes are returned by /api/auth/v2/login. New codes can
// be added without touching the route's contract: anything we do
// not recognize falls through to the raw message.
function mapLoginError(code: string | undefined, status: number): string {
  if (status === 429 || code === 'too_many_requests') {
    return 'Too many attempts. Wait a minute and try again.'
  }
  if (code === 'email_not_confirmed') {
    return 'Confirm your email first. Check your inbox or spam folder.'
  }
  if (code === 'user_banned') {
    return 'This account is locked. Contact us if you think this is a mistake.'
  }
  if (code === 'mfa_required') {
    return 'Two-factor sign-in is on for this account, but it is not yet supported here. Use a passkey or contact us.'
  }
  if (code === 'invalid credentials') {
    return 'Wrong email or password.'
  }
  return code ?? `Sign in failed (${status}).`
}

function LockIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

interface FieldProps {
  label: string
  type: 'email' | 'password' | 'text'
  value: string
  onChange: (next: string) => void
  autoComplete?: string
  autoFocus?: boolean
  disabled?: boolean
}

function Field({ label, type, value, onChange, autoComplete, autoFocus, disabled }: FieldProps) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-1)' }}>
      <span
        style={{
          fontSize: 'var(--v2-text-xs)',
          fontWeight: 'var(--v2-weight-semibold)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--v2-text-muted)',
        }}
      >
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        disabled={disabled}
        style={{
          padding: 'var(--v2-space-3)',
          fontSize: 'var(--v2-text-base)',
          borderRadius: 'var(--v2-radius-md)',
          background: 'var(--v2-bg-primary)',
          border: '1px solid var(--v2-border-strong)',
          color: 'var(--v2-text-primary)',
        }}
      />
    </label>
  )
}

function Divider({ label }: { label: string }) {
  return (
    <div
      role="separator"
      aria-label={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--v2-space-2)',
        margin: 'var(--v2-space-1) 0',
      }}
    >
      <span style={{ flex: 1, height: 1, background: 'var(--v2-border-subtle)' }} />
      <span
        style={{
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </span>
      <span style={{ flex: 1, height: 1, background: 'var(--v2-border-subtle)' }} />
    </div>
  )
}
