'use client'

/**
 * Step 6: Insurance
 *
 * Searchable picker over INSURANCE_PLAN_DEFINITIONS (PR #90 expanded
 * this catalog to 12 carriers + Medicare + Medicaid + self-pay).
 * Picking a plan saves it to health_profile.insurance which the AI
 * permanent-core injects so advice can be tailored to the carrier
 * (referral rules, prior auth thresholds, appeals timing).
 */
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card } from '@/v2/components/primitives'
import OnboardingShell from '../../_components/OnboardingShell'
import { STEP_TITLES } from './config'
import type { StepNumber } from './config'
import {
  INSURANCE_PLAN_DEFINITIONS,
  type InsurancePlanDefinition,
} from '@/lib/api/insurance'
import type { InsuranceDraft } from './load-draft'

interface StepInsuranceProps {
  step: StepNumber
  totalSteps: number
  initial: InsuranceDraft | null
}

export default function StepInsurance({ step, totalSteps, initial }: StepInsuranceProps) {
  const router = useRouter()
  const titleCfg = STEP_TITLES[step]

  const [planSlug, setPlanSlug] = useState<string>(initial?.planSlug ?? '')
  const [memberId, setMemberId] = useState<string>(initial?.memberId ?? '')
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => filterDefs(INSURANCE_PLAN_DEFINITIONS, query), [query])

  async function onContinue() {
    setSaving(true)
    setError(null)
    if (!planSlug) {
      // No plan picked: just advance, no save.
      router.push('/v2/onboarding/7')
      return
    }
    try {
      const res = await fetch('/api/v2/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          step: 'insurance',
          data: {
            planSlug,
            ...(memberId.trim() ? { memberId: memberId.trim() } : {}),
          },
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? 'Save failed. Try again in a moment.')
        setSaving(false)
        return
      }
      router.push('/v2/onboarding/7')
    } catch {
      setError('Network hiccup. Check your connection and try again.')
      setSaving(false)
    }
  }

  return (
    <OnboardingShell
      step={step}
      totalSteps={totalSteps}
      title={titleCfg.title}
      subtitle={titleCfg.subtitle}
      primaryAction={
        <Button variant="primary" size="lg" fullWidth onClick={onContinue} disabled={saving}>
          {saving ? 'Saving' + '…' : planSlug ? 'Continue' : 'Skip and continue'}
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
        <input
          type="search"
          placeholder="Search carriers"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            padding: 'var(--v2-space-3)',
            fontSize: 'var(--v2-text-base)',
            borderRadius: 'var(--v2-radius-md)',
            background: 'var(--v2-bg-card)',
            border: '1px solid var(--v2-border-strong)',
            color: 'var(--v2-text-primary)',
            fontFamily: 'inherit',
          }}
        />
        <Card padding="none">
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {filtered.map((def) => {
              const selected = def.slug === planSlug
              return (
                <li key={def.slug}>
                  <button
                    type="button"
                    onClick={() => setPlanSlug(def.slug)}
                    aria-pressed={selected}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: 'var(--v2-space-3) var(--v2-space-4)',
                      background: selected ? 'var(--v2-bg-elevated)' : 'transparent',
                      border: 0,
                      borderBottom: '1px solid var(--v2-border-subtle)',
                      color: 'var(--v2-text-primary)',
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <span style={{ fontSize: 'var(--v2-text-base)', fontWeight: 'var(--v2-weight-semibold)' }}>
                      {def.label}
                    </span>
                    <span style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-muted)' }}>
                      {def.description}
                    </span>
                  </button>
                </li>
              )
            })}
            {filtered.length === 0 && (
              <li
                style={{
                  padding: 'var(--v2-space-4)',
                  fontSize: 'var(--v2-text-sm)',
                  color: 'var(--v2-text-muted)',
                }}
              >
                No matches. Try a shorter search.
              </li>
            )}
          </ul>
        </Card>

        {planSlug && (
          <Card>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-1)' }}>
              <span
                style={{
                  fontSize: 'var(--v2-text-xs)',
                  fontWeight: 'var(--v2-weight-semibold)',
                  color: 'var(--v2-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Member ID (optional)
              </span>
              <input
                type="text"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                placeholder="From the front of your card"
                autoComplete="off"
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
            </label>
          </Card>
        )}

        {error && (
          <p
            role="alert"
            style={{ margin: 0, color: 'var(--v2-accent-danger)', fontSize: 'var(--v2-text-sm)' }}
          >
            {error}
          </p>
        )}
      </div>
    </OnboardingShell>
  )
}

function filterDefs(
  defs: InsurancePlanDefinition[],
  query: string,
): InsurancePlanDefinition[] {
  const q = query.trim().toLowerCase()
  if (!q) return defs
  return defs.filter(
    (d) =>
      d.label.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q),
  )
}
