'use client'

/**
 * Client form for /v2/signup.
 *
 * Four create-account options stacked top to bottom:
 *   1. Continue with Apple        (Supabase OAuth -> /auth/callback)
 *   2. Continue with Google       (Supabase OAuth -> /auth/callback)
 *   3. Use a passkey              (only available once an account
 *                                   exists, so the button is hidden
 *                                   on signup; surface a hint instead)
 *   4. Email + password           (POST /api/auth/v2/signup)
 *
 * If the response says `requiresEmailConfirmation` we show a "check
 * your inbox" card; otherwise we navigate straight into the
 * onboarding wizard.
 */
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, Button } from '@/v2/components/primitives'
import AppleSignInButton from '@/v2/components/auth/AppleSignInButton'
import GoogleSignInButton from '@/v2/components/auth/GoogleSignInButton'

export function SignupForm() {
  const router = useRouter()
  const params = useSearchParams()
  const returnTo = safeReturn(params.get('returnTo'))
  const errorParam = params.get('error')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [state, setState] = useState<'idle' | 'submitting' | 'error' | 'verify'>('idle')
  const [errMsg, setErrMsg] = useState<string | null>(null)

  useEffect(() => {
    if (errorParam) setErrMsg(errorParam)
  }, [errorParam])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (state === 'submitting') return
    if (password.length < 8) {
      setErrMsg('Password must be at least 8 characters.')
      setState('error')
      return
    }
    if (password !== confirm) {
      setErrMsg('Passwords do not match.')
      setState('error')
      return
    }
    setState('submitting')
    setErrMsg(null)
    try {
      const res = await fetch('/api/auth/v2/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; requiresEmailConfirmation?: boolean; error?: string }
        | null
      if (!res.ok || !body?.ok) {
        setErrMsg(body?.error ?? `Sign up failed (${res.status}).`)
        setState('error')
        return
      }
      if (body.requiresEmailConfirmation) {
        setState('verify')
        return
      }
      // New accounts route through the onboarding wizard. Returning
      // users (already onboarded) bounce out of the wizard immediately
      // via /v2/onboarding's redirect, so there's no risk of trapping
      // them. The returnTo param still carries through for callers
      // that want a deep-link after signup.
      const target = returnTo === '/v2' ? '/v2/onboarding/1' : returnTo
      router.push(target)
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
            Create your account
          </h1>
          <p
            style={{
              fontSize: 'var(--v2-text-base)',
              color: 'var(--v2-text-muted)',
              margin: 'var(--v2-space-2) 0 0',
            }}
          >
            Pick how you want to sign up. We never share your data with these providers.
          </p>
        </header>

        {state === 'verify' ? (
          <Card>
            <h2
              style={{
                fontSize: 'var(--v2-text-lg)',
                fontWeight: 'var(--v2-weight-semibold)',
                color: 'var(--v2-text-primary)',
                margin: '0 0 var(--v2-space-2)',
              }}
            >
              Check your inbox
            </h2>
            <p style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-primary)', margin: 0 }}>
              We sent a confirmation link to <strong>{email}</strong>. Click it to finish setting up your
              account.
            </p>
          </Card>
        ) : (
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
              <AppleSignInButton redirectTo={returnTo} onError={setErrMsg} />
              <GoogleSignInButton redirectTo={returnTo} onError={setErrMsg} />

              <p
                style={{
                  fontSize: 'var(--v2-text-xs)',
                  color: 'var(--v2-text-muted)',
                  textAlign: 'center',
                  margin: 0,
                }}
              >
                You can add a passkey for Face ID or Touch ID once you are signed in.
              </p>

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
                  autoComplete="new-password"
                  value={password}
                  onChange={(v) => {
                    setPassword(v)
                    if (state === 'error') setState('idle')
                  }}
                  disabled={state === 'submitting'}
                />
                <Field
                  label="Confirm password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(v) => {
                    setConfirm(v)
                    if (state === 'error') setState('idle')
                  }}
                  disabled={state === 'submitting'}
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  fullWidth
                  disabled={state === 'submitting' || !email || !password || !confirm}
                >
                  {state === 'submitting' ? 'Creating account' + '…' : 'Create account'}
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
        )}

        <p style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-muted)', textAlign: 'center', margin: 0 }}>
          Already have an account?{' '}
          <Link
            href={`/v2/login${returnTo !== '/v2' ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}
            style={{ color: 'var(--v2-accent-primary)', textDecoration: 'none', fontWeight: 'var(--v2-weight-semibold)' }}
          >
            Sign in
          </Link>
        </p>
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
