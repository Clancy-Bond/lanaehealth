'use client'

/**
 * Client form for /v2/forgot-password. POSTs { email } to
 * /api/auth/v2/forgot-password and always shows the same
 * confirmation message regardless of whether the address
 * exists. Avoids account enumeration.
 */
import { useState } from 'react'
import Link from 'next/link'
import { Card, Button } from '@/v2/components/primitives'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'submitting' | 'sent' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (state === 'submitting' || !email) return
    setState('submitting')
    setErrMsg(null)
    try {
      const res = await fetch('/api/auth/v2/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        setErrMsg(`Request failed (${res.status}).`)
        setState('error')
        return
      }
      setState('sent')
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
            Reset your password
          </h1>
          <p
            style={{
              fontSize: 'var(--v2-text-base)',
              color: 'var(--v2-text-muted)',
              margin: 'var(--v2-space-2) 0 0',
            }}
          >
            Enter your email and we will send a reset link.
          </p>
        </header>

        <Card>
          {state === 'sent' ? (
            <p style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-primary)', margin: 0 }}>
              If an account exists for <strong>{email}</strong>, a reset email is on the way.
            </p>
          ) : (
            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
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
                  Email
                </span>
                <input
                  type="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (state === 'error') setState('idle')
                  }}
                  disabled={state === 'submitting'}
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
              <Button
                type="submit"
                variant="primary"
                size="md"
                fullWidth
                disabled={state === 'submitting' || !email}
              >
                {state === 'submitting' ? 'Sending' + '…' : 'Send reset link'}
              </Button>
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
            </form>
          )}
        </Card>

        <p style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-muted)', textAlign: 'center', margin: 0 }}>
          <Link href="/v2/login" style={{ color: 'var(--v2-accent-primary)', textDecoration: 'none' }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
