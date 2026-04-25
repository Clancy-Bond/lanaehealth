'use client'

/*
 * AccountCard
 *
 * Sits at the very top of /v2/settings. Shows the signed-in user
 * email and provides two actions:
 *   - Sign out: POST /api/auth/v2/logout, then push to /v2/login
 *   - Delete account: DELETE /api/auth/v2/account (with confirm),
 *     then push to /v2/login
 *
 * Voice: short, kind, explanatory. The destructive action requires
 * a typed confirmation ("delete my account") to avoid taps.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Button } from '@/v2/components/primitives'

export interface AccountCardProps {
  email: string | null
}

export default function AccountCard({ email }: AccountCardProps) {
  const router = useRouter()
  const [busy, setBusy] = useState<'idle' | 'signing-out' | 'deleting'>('idle')
  const [confirming, setConfirming] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [errMsg, setErrMsg] = useState<string | null>(null)

  async function signOut() {
    if (busy !== 'idle') return
    setBusy('signing-out')
    setErrMsg(null)
    try {
      await fetch('/api/auth/v2/logout', { method: 'POST' })
    } catch {
      // Even if the server call fails, push to login. The cookie
      // either cleared or it did not; user can clear cache as a
      // last resort.
    }
    router.push('/v2/login')
    router.refresh()
  }

  async function deleteAccount() {
    if (busy !== 'idle') return
    if (confirmText.trim().toLowerCase() !== 'delete my account') {
      setErrMsg('Please type the confirmation phrase exactly.')
      return
    }
    setBusy('deleting')
    setErrMsg(null)
    try {
      const res = await fetch('/api/auth/v2/account', { method: 'DELETE' })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        setErrMsg(body?.error ?? `Could not delete account (${res.status}).`)
        setBusy('idle')
        return
      }
      router.push('/v2/login')
      router.refresh()
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Network error.')
      setBusy('idle')
    }
  }

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
            Account
          </h2>
          <p
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-muted)',
              margin: 'var(--v2-space-1) 0 0',
            }}
          >
            {email ?? 'Not signed in'}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
          <Button
            variant="secondary"
            size="md"
            fullWidth
            onClick={signOut}
            disabled={busy !== 'idle'}
          >
            {busy === 'signing-out' ? 'Signing out' + '…' : 'Sign out'}
          </Button>

          {!confirming ? (
            <Button
              variant="destructive"
              size="md"
              fullWidth
              onClick={() => {
                setConfirming(true)
                setErrMsg(null)
              }}
              disabled={busy !== 'idle'}
            >
              Delete account
            </Button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
              <p
                style={{
                  fontSize: 'var(--v2-text-sm)',
                  color: 'var(--v2-text-primary)',
                  margin: 0,
                }}
              >
                This permanently removes your account and all your health data. To confirm, type
                <strong> delete my account</strong> below.
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="delete my account"
                disabled={busy !== 'idle'}
                style={{
                  padding: 'var(--v2-space-3)',
                  fontSize: 'var(--v2-text-base)',
                  borderRadius: 'var(--v2-radius-md)',
                  background: 'var(--v2-bg-primary)',
                  border: '1px solid var(--v2-border-strong)',
                  color: 'var(--v2-text-primary)',
                }}
              />
              <div style={{ display: 'flex', gap: 'var(--v2-space-2)' }}>
                <Button
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={() => {
                    setConfirming(false)
                    setConfirmText('')
                    setErrMsg(null)
                  }}
                  disabled={busy !== 'idle'}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="md"
                  fullWidth
                  onClick={deleteAccount}
                  disabled={busy !== 'idle'}
                >
                  {busy === 'deleting' ? 'Deleting' + '…' : 'Confirm delete'}
                </Button>
              </div>
            </div>
          )}

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
      </div>
    </Card>
  )
}
