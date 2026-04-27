'use client'

/*
 * ChangePasswordCard
 *
 * In-app password change for the signed-in user. Sits in
 * /v2/settings under the AccountCard so it stays close to the
 * other security-shaped controls (sign out, delete account).
 *
 * UX rules:
 *   - Idle state: a single "Change password" button so the
 *     three input fields do not pollute settings for users who
 *     do not need them.
 *   - Open state: current password + new password + confirm
 *     fields, plus a Save / Cancel pair.
 *   - All three fields require a value. New + confirm must
 *     match. The backend re-validates length and re-verifies
 *     the current password, so client-side checks here are a
 *     UX accelerant, not a security guarantee.
 *   - On success: collapse the form, clear the inputs, show a
 *     short confirmation that auto-fades.
 *
 * Voice: short and kind. Errors are quoted from the API
 * verbatim so the user sees the actual reason ("Current
 * password is incorrect.") rather than a generic phrase.
 */
import { useState } from 'react'
import { Card, Button } from '@/v2/components/primitives'

const MIN_LENGTH = 8

type Status =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'error'; message: string }
  | { kind: 'success' }

export default function ChangePasswordCard() {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  function reset() {
    setCurrent('')
    setNext('')
    setConfirm('')
    setStatus({ kind: 'idle' })
  }

  async function onSave() {
    if (!current) return setStatus({ kind: 'error', message: 'Enter your current password.' })
    if (next.length < MIN_LENGTH)
      return setStatus({ kind: 'error', message: `New password must be at least ${MIN_LENGTH} characters.` })
    if (next !== confirm)
      return setStatus({ kind: 'error', message: 'New password and confirmation do not match.' })
    if (next === current)
      return setStatus({ kind: 'error', message: 'New password must be different from current.' })

    setStatus({ kind: 'saving' })
    try {
      const res = await fetch('/api/auth/v2/change-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        return setStatus({
          kind: 'error',
          message: body?.error ?? `Could not update password (${res.status}).`,
        })
      }
      setStatus({ kind: 'success' })
      // Auto-collapse after a beat so the success message has time
      // to register but the form does not linger.
      setTimeout(() => {
        setOpen(false)
        reset()
      }, 1500)
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error. Try again.',
      })
    }
  }

  const isSaving = status.kind === 'saving'

  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
        <div>
          <h2
            style={{
              fontSize: 'var(--v2-text-lg)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
              margin: 0,
            }}
          >
            Password
          </h2>
          <p
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-muted)',
              margin: 'var(--v2-space-1) 0 0',
            }}
          >
            {open
              ? 'Type your current password, then a new one.'
              : 'Change the password you use to sign in.'}
          </p>
        </div>

        {!open ? (
          <Button
            variant="secondary"
            size="md"
            fullWidth
            onClick={() => {
              reset()
              setOpen(true)
            }}
          >
            Change password
          </Button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
            <PasswordField
              label="Current password"
              value={current}
              onChange={setCurrent}
              autoComplete="current-password"
              disabled={isSaving}
            />
            <PasswordField
              label="New password"
              value={next}
              onChange={setNext}
              autoComplete="new-password"
              disabled={isSaving}
              hint={`At least ${MIN_LENGTH} characters.`}
            />
            <PasswordField
              label="Confirm new password"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              disabled={isSaving}
            />

            <div style={{ display: 'flex', gap: 'var(--v2-space-2)' }}>
              <Button
                variant="secondary"
                size="md"
                fullWidth
                onClick={() => {
                  setOpen(false)
                  reset()
                }}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button variant="primary" size="md" fullWidth onClick={onSave} disabled={isSaving}>
                {isSaving ? 'Saving' + '…' : 'Save password'}
              </Button>
            </div>

            {status.kind === 'error' && (
              <p
                role="alert"
                style={{
                  fontSize: 'var(--v2-text-sm)',
                  color: 'var(--v2-accent-danger)',
                  margin: 0,
                }}
              >
                {status.message}
              </p>
            )}
            {status.kind === 'success' && (
              <p
                role="status"
                style={{
                  fontSize: 'var(--v2-text-sm)',
                  color: 'var(--v2-accent-success)',
                  margin: 0,
                }}
              >
                Password updated. You stay signed in.
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

interface PasswordFieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  autoComplete: 'current-password' | 'new-password'
  disabled?: boolean
  hint?: string
}

function PasswordField({ label, value, onChange, autoComplete, disabled, hint }: PasswordFieldProps) {
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
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        disabled={disabled}
        style={{
          padding: 'var(--v2-space-3)',
          fontSize: 'var(--v2-text-base)',
          borderRadius: 'var(--v2-radius-md)',
          background: 'var(--v2-bg-primary)',
          border: '1px solid var(--v2-border-strong)',
          color: 'var(--v2-text-primary)',
          fontFamily: 'inherit',
        }}
      />
      {hint && (
        <span
          style={{
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-muted)',
          }}
        >
          {hint}
        </span>
      )}
    </label>
  )
}
