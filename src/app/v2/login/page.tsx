/**
 * /v2/login -- Supabase Auth email + password sign-in.
 *
 * The v2 auth surfaces (login, signup, forgot-password) are the
 * three routes the new middleware allows pre-auth. Everything
 * else under /v2/* requires a Supabase session cookie.
 *
 * The page is a thin server shell that hosts the client form.
 */
import { Suspense } from 'react'
import { LoginForm } from './LoginForm'

export const dynamic = 'force-dynamic'

export default function V2LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
