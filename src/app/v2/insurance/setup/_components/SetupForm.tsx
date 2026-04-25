'use client'

/*
 * SetupForm
 *
 * Client form for /v2/insurance/setup. Submits to PUT /api/insurance
 * and redirects to /v2/insurance on success. The plan options are
 * server-driven (passed from page.tsx) so the source of truth stays
 * in src/lib/api/insurance.ts.
 */
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card } from '@/v2/components/primitives'
import type {
  InsurancePlanDefinition,
  InsurancePlanSlug,
  InsuranceProfile,
} from '@/lib/api/insurance'

export interface SetupFormProps {
  definitions: InsurancePlanDefinition[]
  initialProfile: InsuranceProfile | null
}

export default function SetupForm({ definitions, initialProfile }: SetupFormProps) {
  const router = useRouter()
  const [planSlug, setPlanSlug] = useState<InsurancePlanSlug>(
    initialProfile?.planSlug ?? 'hmsa-quest',
  )
  const [memberId, setMemberId] = useState(initialProfile?.memberId ?? '')
  const [notes, setNotes] = useState(initialProfile?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const res = await fetch('/api/insurance', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          planSlug,
          memberId: memberId.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? 'Save failed. Try again in a moment.')
        setSaving(false)
        return
      }
      router.push('/v2/insurance')
      router.refresh()
    } catch {
      setError('Network hiccup. Check your connection and try again.')
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}
    >
      <Card>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-secondary)',
            lineHeight: 'var(--v2-leading-relaxed)',
          }}
        >
          Pick the plan you currently use. We use this to show the right
          guide on the hub. You can change it any time.
        </p>
      </Card>

      <Card>
        <fieldset
          style={{
            border: 0,
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-2)',
          }}
        >
          <legend
            style={{
              fontSize: 'var(--v2-text-base)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
              marginBottom: 'var(--v2-space-2)',
            }}
          >
            Your plan
          </legend>
          {definitions.map((def) => {
            const checked = planSlug === def.slug
            return (
              <label
                key={def.slug}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--v2-space-3)',
                  padding: 'var(--v2-space-3)',
                  borderRadius: 'var(--v2-radius-md)',
                  border: `1px solid ${checked ? 'var(--v2-accent-primary)' : 'var(--v2-border-subtle)'}`,
                  cursor: 'pointer',
                  background: checked ? 'var(--v2-accent-primary-soft)' : 'transparent',
                }}
              >
                <input
                  type="radio"
                  name="planSlug"
                  value={def.slug}
                  checked={checked}
                  onChange={() => setPlanSlug(def.slug)}
                  style={{ marginTop: 4 }}
                />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span
                    style={{
                      fontSize: 'var(--v2-text-base)',
                      fontWeight: 'var(--v2-weight-medium)',
                      color: 'var(--v2-text-primary)',
                    }}
                  >
                    {def.label}
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--v2-text-sm)',
                      color: 'var(--v2-text-secondary)',
                      lineHeight: 'var(--v2-leading-relaxed)',
                    }}
                  >
                    {def.description}
                  </span>
                </span>
              </label>
            )
          })}
        </fieldset>
      </Card>

      <Card>
        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-1)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--v2-text-sm)',
              fontWeight: 'var(--v2-weight-medium)',
              color: 'var(--v2-text-primary)',
            }}
          >
            Member ID (optional)
          </span>
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
            }}
          >
            We never share this. It just shows up on your hub for quick reference.
          </span>
          <input
            type="text"
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            inputMode="text"
            autoComplete="off"
            maxLength={64}
            style={{
              marginTop: 'var(--v2-space-2)',
              minHeight: 'var(--v2-touch-target-min)',
              padding: '0 var(--v2-space-3)',
              borderRadius: 'var(--v2-radius-md)',
              border: '1px solid var(--v2-border-subtle)',
              background: 'var(--v2-bg-surface)',
              color: 'var(--v2-text-primary)',
              fontSize: 'var(--v2-text-base)',
              fontFamily: 'inherit',
            }}
          />
        </label>

        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-1)',
            marginTop: 'var(--v2-space-3)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--v2-text-sm)',
              fontWeight: 'var(--v2-weight-medium)',
              color: 'var(--v2-text-primary)',
            }}
          >
            Notes (optional)
          </span>
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
            }}
          >
            Group number, plan effective date, anything you want to remember.
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={280}
            rows={3}
            style={{
              marginTop: 'var(--v2-space-2)',
              padding: 'var(--v2-space-3)',
              borderRadius: 'var(--v2-radius-md)',
              border: '1px solid var(--v2-border-subtle)',
              background: 'var(--v2-bg-surface)',
              color: 'var(--v2-text-primary)',
              fontSize: 'var(--v2-text-base)',
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
        </label>
      </Card>

      {error && (
        <Card>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-accent-warning)',
            }}
          >
            {error}
          </p>
        </Card>
      )}

      <Button type="submit" variant="primary" size="lg" fullWidth disabled={saving}>
        {saving ? 'Saving...' : 'Save and continue'}
      </Button>
    </form>
  )
}
