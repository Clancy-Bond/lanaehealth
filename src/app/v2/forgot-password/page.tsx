/**
 * /v2/forgot-password -- request a password reset email.
 *
 * Public per middleware allowlist. Always returns a confirmation
 * message (never reveals whether the email exists).
 */
import { ForgotPasswordForm } from './ForgotPasswordForm'

export const dynamic = 'force-dynamic'

export default function V2ForgotPasswordPage() {
  return <ForgotPasswordForm />
}
