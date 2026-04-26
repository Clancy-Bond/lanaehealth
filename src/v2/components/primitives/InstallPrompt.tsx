'use client'

/*
 * InstallPrompt
 *
 * A small, dismissable banner that appears once the browser has fired
 * `beforeinstallprompt`. Tapping "Add to home screen" calls the saved
 * BeforeInstallPromptEvent.prompt() so iOS / Android show the native
 * install dialog. Dismissals are remembered in localStorage for 30 days
 * so the banner does not nag.
 *
 * Hidden when:
 *   - The browser never fires beforeinstallprompt (already installed,
 *     or browser does not support the prompt event, e.g. Safari).
 *   - The app is already running in standalone display mode.
 *   - The user dismissed within the last 30 days.
 *
 * Voice: short, kind, explanatory. No em-dashes.
 */
import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'lanae-pwa-install-dismissed-at'
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true
  // iOS Safari surfaces standalone via navigator.standalone.
  type IosNavigator = Navigator & { standalone?: boolean }
  if ((window.navigator as IosNavigator).standalone) return true
  return false
}

function recentlyDismissed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const ts = Number(raw)
    if (!Number.isFinite(ts)) return false
    return Date.now() - ts < DISMISS_TTL_MS
  } catch {
    return false
  }
}

function shouldStartHidden(): boolean {
  if (typeof window === 'undefined') return true
  return isStandalone() || recentlyDismissed()
}

export default function InstallPrompt() {
  // Lazy initial state reads localStorage / standalone status once at
  // mount, never inside an effect body.
  const [hidden, setHidden] = useState<boolean>(() => shouldStartHidden())
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    function onBeforeInstall(e: Event) {
      e.preventDefault()
      setEvt(e as BeforeInstallPromptEvent)
    }
    function onInstalled() {
      setEvt(null)
      setHidden(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // Non-fatal. The banner just reappears next session.
    }
    setHidden(true)
  }

  async function install() {
    if (!evt) return
    try {
      await evt.prompt()
      await evt.userChoice
    } catch {
      // User backed out or browser blocked the prompt. Treat as dismiss.
    }
    dismiss()
    setEvt(null)
  }

  if (hidden || !evt) return null

  return (
    <div
      role="dialog"
      aria-label="Install LanaeHealth"
      data-testid="pwa-install-prompt"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--v2-space-3, 12px)',
        padding: 'var(--v2-space-3, 12px) var(--v2-space-4, 16px)',
        borderRadius: 'var(--v2-radius-md, 12px)',
        background: 'var(--v2-accent-primary-soft, rgba(77, 184, 168, 0.16))',
        border: '1px solid var(--v2-accent-primary, #4DB8A8)',
        color: 'var(--v2-text-primary)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 'var(--v2-text-base, 15px)',
            fontWeight: 600,
            color: 'var(--v2-accent-primary, #4DB8A8)',
          }}
        >
          Install LanaeHealth
        </div>
        <div
          style={{
            fontSize: 'var(--v2-text-sm, 13px)',
            color: 'var(--v2-text-secondary, #B0B3BD)',
            marginTop: 2,
            lineHeight: 1.45,
          }}
        >
          Add to your home screen for one-tap access and offline view.
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button
            type="button"
            onClick={install}
            style={{
              background: 'var(--v2-accent-primary, #4DB8A8)',
              color: 'var(--v2-on-accent, #1A1A1E)',
              border: 0,
              borderRadius: 'var(--v2-radius-full, 999px)',
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              minHeight: 'var(--v2-touch-target-min, 44px)',
              fontFamily: 'inherit',
            }}
          >
            Add to home screen
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Not now"
            style={{
              background: 'transparent',
              color: 'var(--v2-text-muted, #7E8088)',
              border: 0,
              padding: '8px 14px',
              fontSize: 13,
              cursor: 'pointer',
              minHeight: 'var(--v2-touch-target-min, 44px)',
              fontFamily: 'inherit',
            }}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
