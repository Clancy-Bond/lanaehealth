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
  const returnTo = safeReturn(params.get('returnTo'))
  const justReset = params.get('reset') === '1'
  const errorParam = params.get('error')

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
        setErrMsg(body?.error === 'invalid credentials' ? 'Wrong email or password.' : (body?.error ?? `Sign in failed (${res.status}).`))
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
          <h1
            style={{
              fontSize: 'var(--v2-text-2xl)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
              margin: 0,
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
