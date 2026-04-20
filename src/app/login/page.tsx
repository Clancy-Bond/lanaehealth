/**
 * /login -- shared-secret password form.
 *
 * The perimeter middleware redirects unauthenticated browser traffic to
 * this page (src/middleware.ts:138-143) and the per-route requireAuth()
 * check rejects API calls that lack a valid session cookie. Both land
 * the user here when APP_AUTH_TOKEN + APP_AUTH_PASSWORD are configured
 * and the user has not yet signed in.
 *
 * The page is a thin server shell that hosts the client form. No data
 * fetching. Marked public in middleware.ts so the redirect target is
 * reachable pre-auth.
 */

import { Suspense } from 'react';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '48px 16px',
        background: 'var(--bg-primary)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <header style={{ textAlign: 'center', marginBottom: 8 }}>
          <div
            aria-hidden
            style={{
              width: 52,
              height: 52,
              borderRadius: 'var(--radius-full)',
              background: 'var(--accent-sage-muted)',
              margin: '0 auto 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
            }}
          >
            {'\u{1F512}'}
          </div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: 'var(--text-primary)',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            LanaeHealth
          </h1>
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              margin: '4px 0 0',
              lineHeight: 1.5,
            }}
          >
            Sign in to continue
          </p>
        </header>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
