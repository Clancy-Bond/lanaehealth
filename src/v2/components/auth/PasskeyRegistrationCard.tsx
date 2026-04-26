'use client'

/**
 * PasskeyRegistrationCard
 *
 * Lives in /v2/settings under "Security". Lists the passkeys the
 * signed-in user has registered, lets them add a new one, and lets
 * them remove an existing one.
 *
 * The "Add a passkey" action calls /api/auth/passkey/register?phase=options,
 * passes the result to startRegistration() (which prompts Face ID /
 * Touch ID / Windows Hello), then POSTs the attestation back to
 * verify and store the credential.
 */
import { useEffect, useState } from 'react'
import { startRegistration } from '@simplewebauthn/browser'
import { Card, Button } from '@/v2/components/primitives'

interface Passkey {
  id: string
  device_name: string
  created_at: string
  last_used_at: string | null
}

export default function PasskeyRegistrationCard() {
  const [supported, setSupported] = useState(false)
  const [passkeys, setPasskeys] = useState<Passkey[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined')
    void refresh()
  }, [])

  async function refresh() {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/passkey/list')
      if (res.ok) {
        const body = (await res.json()) as { passkeys?: Passkey[] }
        setPasskeys(body.passkeys ?? [])
      }
    } catch {
      // ignore: surface "could not load" only when the user takes an action
    } finally {
      setLoading(false)
    }
  }

  async function addPasskey() {
    if (busy) return
    setBusy(true)
    setErrMsg(null)
    setOkMsg(null)
    try {
      const optsRes = await fetch('/api/auth/passkey/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: 'options' }),
      })
      if (!optsRes.ok) {
        const body = (await optsRes.json().catch(() => null)) as { error?: string } | null
        setErrMsg(body?.error ?? 'Could not start passkey setup.')
        setBusy(false)
        return
      }
      const { options, challengeId } = (await optsRes.json()) as {
        options: Parameters<typeof startRegistration>[0]['optionsJSON']
        challengeId: string
      }

      let attestation
      try {
        attestation = await startRegistration({ optionsJSON: options })
      } catch (err) {
        setErrMsg(err instanceof Error && err.name === 'InvalidStateError'
          ? 'This device already has a passkey for this account.'
          : `Passkey setup did not finish. ${err instanceof Error ? err.message : ''}`)
        setBusy(false)
        return
      }

      const deviceName = guessDeviceName()
      const verifyRes = await fetch('/api/auth/passkey/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: 'verify', challengeId, attestation, deviceName }),
      })
      if (!verifyRes.ok) {
        const body = (await verifyRes.json().catch(() => null)) as { error?: string } | null
        setErrMsg(body?.error ?? 'Could not save passkey.')
        setBusy(false)
        return
      }
      setOkMsg('Passkey added. Next time you sign in, tap "Use a passkey".')
      await refresh()
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Network error.')
    } finally {
      setBusy(false)
    }
  }

  async function removePasskey(id: string) {
    if (busy) return
    if (!confirm('Remove this passkey from your account?')) return
    setBusy(true)
    setErrMsg(null)
    setOkMsg(null)
    try {
      const res = await fetch(`/api/auth/passkey/list?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        setErrMsg(body?.error ?? 'Could not remove passkey.')
        setBusy(false)
        return
      }
      setOkMsg('Passkey removed.')
      await refresh()
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Network error.')
    } finally {
      setBusy(false)
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
            Security
          </h2>
          <p
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-muted)',
              margin: 'var(--v2-space-1) 0 0',
            }}
          >
            Add a passkey so you can sign in with Face ID, Touch ID, or your device password instead of typing.
          </p>
        </div>

        {!supported && (
          <p
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-muted)',
              margin: 0,
            }}
          >
            This browser does not support passkeys. Try Safari on iOS or Chrome on a recent device.
          </p>
        )}

        {supported && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
              {loading ? (
                <p style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-muted)', margin: 0 }}>
                  Loading your passkeys{'…'}
                </p>
              ) : passkeys.length === 0 ? (
                <p style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-muted)', margin: 0 }}>
                  No passkeys yet.
                </p>
              ) : (
                passkeys.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 'var(--v2-space-2)',
                      padding: 'var(--v2-space-2) var(--v2-space-3)',
                      background: 'var(--v2-bg-primary)',
                      borderRadius: 'var(--v2-radius-md)',
                      border: '1px solid var(--v2-border-subtle)',
                    }}
                  >
                    <div>
                      <p style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-primary)', margin: 0 }}>
                        {p.device_name}
                      </p>
                      <p style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)', margin: 0 }}>
                        Added {formatDate(p.created_at)}
                        {p.last_used_at ? ` , last used ${formatDate(p.last_used_at)}` : ''}
                      </p>
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => removePasskey(p.id)} disabled={busy}>
                      Remove
                    </Button>
                  </div>
                ))
              )}
            </div>

            <Button variant="secondary" size="md" fullWidth onClick={addPasskey} disabled={busy}>
              {busy ? 'Talking to your device' + '…' : 'Add a passkey'}
            </Button>

            {okMsg && (
              <p style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-accent-success)', margin: 0 }}>{okMsg}</p>
            )}
            {errMsg && (
              <p role="alert" style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-accent-danger)', margin: 0 }}>
                {errMsg}
              </p>
            )}
          </>
        )}
      </div>
    </Card>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function guessDeviceName(): string {
  if (typeof navigator === 'undefined') return 'Passkey'
  const ua = navigator.userAgent
  if (/iPhone/i.test(ua)) return 'iPhone passkey'
  if (/iPad/i.test(ua)) return 'iPad passkey'
  if (/Mac/i.test(ua)) return 'Mac passkey'
  if (/Android/i.test(ua)) return 'Android passkey'
  if (/Windows/i.test(ua)) return 'Windows passkey'
  return 'Passkey'
}
