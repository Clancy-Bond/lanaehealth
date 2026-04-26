'use client'

/**
 * Step 3: Conditions
 *
 * Searchable multi-select over the 50+ entry CONDITIONS_CATALOG.
 * Selected pills surface at the top so the user can see their picks
 * without scrolling. A free-text "Other" field appends a custom
 * label to the list. Submitting writes both:
 *   - health_profile.confirmed_diagnoses (the lean list permanent-core
 *     injects into every Claude API call)
 *   - active_problems rows (so the AI's summary engine and timeline
 *     surfaces pick them up)
 */
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card } from '@/v2/components/primitives'
import OnboardingShell from '../../_components/OnboardingShell'
import { STEP_TITLES } from './config'
import type { StepNumber } from './config'
import {
  CATEGORY_LABELS,
  searchConditions,
  type ConditionOption,
} from '@/lib/v2/onboarding/conditions-catalog'

interface StepConditionsProps {
  step: StepNumber
  totalSteps: number
  initial: string[]
}

export default function StepConditions({ step, totalSteps, initial }: StepConditionsProps) {
  const router = useRouter()
  const titleCfg = STEP_TITLES[step]

  const [selected, setSelected] = useState<Set<string>>(new Set(initial))
  const [query, setQuery] = useState('')
  const [otherText, setOtherText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => searchConditions(query), [query])
  const grouped = useMemo(() => groupByCategory(filtered), [filtered])

  function toggle(label: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  function addOther() {
    const v = otherText.trim()
    if (!v) return
    setSelected((prev) => {
      const next = new Set(prev)
      next.add(v)
      return next
    })
    setOtherText('')
  }

  async function onContinue() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/v2/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          step: 'conditions',
          data: { conditions: Array.from(selected) },
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? 'Save failed. Try again in a moment.')
        setSaving(false)
        return
      }
      router.push('/v2/onboarding/4')
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
          {saving ? 'Saving' + '…' : selected.size > 0 ? `Continue (${selected.size})` : 'Continue'}
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
        {selected.size > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--v2-space-2)',
            }}
          >
            {Array.from(selected).map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => toggle(label)}
                aria-label={`Remove ${label}`}
                style={chipStyle(true)}
              >
                {label} <span aria-hidden style={{ marginLeft: 4 }}>×</span>
              </button>
            ))}
          </div>
        )}

        <input
          type="search"
          placeholder="Search conditions"
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

        <Card padding="sm">
          {grouped.length === 0 ? (
            <p
              style={{
                margin: 'var(--v2-space-2) 0',
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-muted)',
              }}
            >
              No matches. Try the &ldquo;Other&rdquo; field below.
            </p>
          ) : (
            grouped.map(([category, options]) => (
              <div key={category} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)', padding: 'var(--v2-space-2) 0' }}>
                <span
                  style={{
                    fontSize: 'var(--v2-text-xs)',
                    fontWeight: 'var(--v2-weight-semibold)',
                    color: 'var(--v2-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  {CATEGORY_LABELS[category]}
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--v2-space-2)' }}>
                  {options.map((opt) => {
                    const on = selected.has(opt.label)
                    return (
                      <button
                        key={opt.slug}
                        type="button"
                        onClick={() => toggle(opt.label)}
                        aria-pressed={on}
                        style={chipStyle(on)}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </Card>

        <Card>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
            <span
              style={{
                fontSize: 'var(--v2-text-xs)',
                fontWeight: 'var(--v2-weight-semibold)',
                color: 'var(--v2-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Other
            </span>
            <div style={{ display: 'flex', gap: 'var(--v2-space-2)' }}>
              <input
                type="text"
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                placeholder="Type a condition we missed"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addOther()
                  }
                }}
                style={{
                  flex: 1,
                  padding: 'var(--v2-space-3)',
                  fontSize: 'var(--v2-text-base)',
                  borderRadius: 'var(--v2-radius-md)',
                  background: 'var(--v2-bg-primary)',
                  border: '1px solid var(--v2-border-strong)',
                  color: 'var(--v2-text-primary)',
                  fontFamily: 'inherit',
                }}
              />
              <Button variant="secondary" onClick={addOther} disabled={!otherText.trim()}>
                Add
              </Button>
            </div>
          </label>
        </Card>

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

function groupByCategory(
  options: ConditionOption[],
): Array<[ConditionOption['category'], ConditionOption[]]> {
  const order: ConditionOption['category'][] = [
    'cardiovascular',
    'connective_tissue',
    'autoimmune',
    'endocrine',
    'metabolic',
    'neurological',
    'pain',
    'gi',
    'reproductive',
    'psychiatric',
    'sleep',
    'other',
  ]
  const map = new Map<ConditionOption['category'], ConditionOption[]>()
  for (const opt of options) {
    const key = opt.category
    const arr = map.get(key) ?? []
    arr.push(opt)
    map.set(key, arr)
  }
  // Stable order regardless of map insertion order.
  return order
    .filter((c) => map.has(c))
    .map((c): [ConditionOption['category'], ConditionOption[]] => [c, map.get(c)!])
    .concat(
      Array.from(map.entries()).filter(([c]) => !order.includes(c)) as Array<
        [ConditionOption['category'], ConditionOption[]]
      >,
    )
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px',
    borderRadius: 'var(--v2-radius-full)',
    border: `1px solid ${active ? 'var(--v2-accent-primary)' : 'var(--v2-border-strong)'}`,
    background: active ? 'var(--v2-accent-primary)' : 'transparent',
    color: active ? 'var(--v2-on-accent)' : 'var(--v2-text-primary)',
    fontSize: 'var(--v2-text-sm)',
    fontFamily: 'inherit',
    cursor: 'pointer',
  }
}
