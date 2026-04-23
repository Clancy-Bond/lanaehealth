'use client'

/*
 * PrivacyTogglesCard
 *
 * Three toggles backed by the privacy_prefs row in Supabase. The
 * PATCH /api/privacy-prefs endpoint is auth-gated, so the session
 * cookie (set by POST /api/auth/login) rides along automatically
 * when the user is logged in. If the user is not logged in the
 * PATCH 401s; we revert the toggle and surface a short error.
 *
 * Each row uses the ListRow primitive with the Toggle primitive
 * in the trailing slot. We update state optimistically so the
 * switch animates immediately, then revert on error. There is no
 * "Saved" chip: a silent toggle with an instant visual change is
 * the calmer option at this density.
 *
 * Copy follows the NC voice: short, kind, explanatory. Each
 * subtext says what the toggle does and what the tradeoff is.
 */
import { useState } from 'react'
import type { PrivacyPrefs } from '@/lib/api/privacy-prefs'
import { Card, ListRow, Toggle } from '@/v2/components/primitives'

export interface PrivacyTogglesCardProps {
  prefs: PrivacyPrefs
}

type ToggleKey =
  | 'allow_claude_context'
  | 'allow_correlation_analysis'
  | 'retain_history_beyond_2y'

interface ToggleDef {
  key: ToggleKey
  label: string
  subtext: string
}

const TOGGLE_DEFS: ToggleDef[] = [
  {
    key: 'allow_claude_context',
    label: 'Use my notes in chat',
    subtext:
      'Lets the assistant reference your symptoms and entries. Turn off and the assistant only sees what you type in the chat.',
  },
  {
    key: 'allow_correlation_analysis',
    label: 'Find patterns in my data',
    subtext:
      'Enables correlation analysis across entries. Turn off to pause new runs; past results stay unless you delete them.',
  },
  {
    key: 'retain_history_beyond_2y',
    label: 'Keep records beyond 2 years',
    subtext:
      'Disable to have older daily logs and symptoms auto-trimmed. Labs, imaging, and the timeline are never swept.',
  },
]

export default function PrivacyTogglesCard({ prefs }: PrivacyTogglesCardProps) {
  const [state, setState] = useState<PrivacyPrefs>(prefs)
  const [error, setError] = useState<string | null>(null)

  async function patch(key: ToggleKey, value: boolean) {
    const previous = state
    // Optimistic: flip first so the switch animates immediately.
    setState({ ...previous, [key]: value, updated_at: new Date().toISOString() })
    setError(null)

    try {
      const res = await fetch('/api/privacy-prefs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(
          res.status === 401
            ? 'Log in on legacy settings to change privacy preferences.'
            : body.error ?? `Save failed (${res.status})`,
        )
      }
      const next = (await res.json()) as PrivacyPrefs
      setState(next)
    } catch (err) {
      setState(previous)
      setError(err instanceof Error ? err.message : 'Could not save. Try again?')
    }
  }

  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
        <h2
          style={{
            fontSize: 'var(--v2-text-lg)',
            fontWeight: 'var(--v2-weight-semibold)',
            color: 'var(--v2-text-primary)',
            margin: 0,
            marginBottom: 'var(--v2-space-1)',
          }}
        >
          Privacy
        </h2>

        <div>
          {TOGGLE_DEFS.map((def, idx) => {
            const value = state[def.key]
            return (
              <ListRow
                key={def.key}
                label={def.label}
                subtext={def.subtext}
                divider={idx < TOGGLE_DEFS.length - 1}
                trailing={
                  <Toggle
                    checked={value}
                    onChange={(next) => patch(def.key, next)}
                  />
                }
              />
            )
          })}
        </div>

        {error && (
          <p
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-accent-danger)',
              margin: 0,
            }}
          >
            {error}
          </p>
        )}
      </div>
    </Card>
  )
}
