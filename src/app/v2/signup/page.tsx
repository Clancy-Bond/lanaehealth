/**
 * /v2/signup -- Supabase Auth email + password account creation.
 *
 * Public per the new middleware allowlist. Forwards through to
 * the signup endpoint and switches to a "check your inbox" view
 * if email confirmation is required by the project Auth config.
 */
import { Suspense } from 'react'
import { SignupForm } from './SignupForm'

export const dynamic = 'force-dynamic'

export default function V2SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  )
}
