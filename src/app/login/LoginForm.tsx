/**
 * Client form for /login.
 *
 * POSTs { password } to /api/auth/login. On 200 the server sets the
 * `lh_session` HttpOnly cookie and we redirect to ?next=... (or /).
 * On 401 we show a quiet error; on 500 we surface the server
 * misconfiguration message so Clancy sees the exact cause if env vars
 * are still missing.
 *
 * No password strength meter or "remember me" toggle -- this is a
 * single-patient app, one shared secret. Keep the surface tiny.
 */

'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/';
  const [password, setPassword] = useState('');
  const [state, setState] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === 'submitting' || password.length === 0) return;
    setState('submitting');
    setErrMsg(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const msg =
          body?.error === 'invalid credentials'
            ? 'Wrong password'
            : body?.error ?? `Login failed (${res.status})`;
        setErrMsg(msg);
        setState('error');
        return;
      }
      // Cookie is set; navigate to requested destination.
      router.push(safeNext(next));
      router.refresh();
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Network error');
      setState('error');
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '20px 18px',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-card)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <label
        htmlFor="lh-password"
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}
      >
        Password
      </label>
      <input
        id="lh-password"
        type="password"
        autoComplete="current-password"
        autoFocus
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          if (state === 'error') setState('idle');
        }}
        disabled={state === 'submitting'}
        style={{
          padding: '12px 14px',
          fontSize: 16,
          fontWeight: 600,
          borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-input)',
          border: '1px solid var(--border-light)',
          color: 'var(--text-primary)',
          letterSpacing: '-0.01em',
        }}
      />
      <button
        type="submit"
        disabled={state === 'submitting' || password.length === 0}
        className="press-feedback"
        style={{
          marginTop: 4,
          padding: '12px 18px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--accent-sage)',
          color: 'var(--text-inverse)',
          border: 'none',
          fontSize: 14,
          fontWeight: 700,
          cursor:
            state === 'submitting' || password.length === 0
              ? 'not-allowed'
              : 'pointer',
          opacity: password.length === 0 ? 0.6 : 1,
        }}
      >
        {state === 'submitting' ? 'Signing in\u2026' : 'Sign in'}
      </button>
      {errMsg && (
        <p
          role="alert"
          style={{
            fontSize: 12,
            color: 'var(--accent-blush)',
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          {errMsg}
        </p>
      )}
    </form>
  );
}

/**
 * Only allow same-origin paths in the `next` query param. Anything that
 * starts with a scheme or a double slash could be an open-redirect.
 */
function safeNext(next: string): string {
  if (!next.startsWith('/')) return '/';
  if (next.startsWith('//')) return '/';
  return next;
}
