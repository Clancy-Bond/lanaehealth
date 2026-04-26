'use client'

/*
 * CarrierBrowser
 *
 * Searchable + grouped picker for the insurance hub. Lists every
 * carrier with hasContentPage = true. Reads the catalog from
 * src/lib/api/insurance.ts (server source of truth).
 *
 * Behavior:
 *   - Plain text search filters labels and descriptions.
 *   - Grouped by 'private' (top private carriers) and 'government'
 *     (Medicare, Medicaid, HMSA QUEST).
 *   - Tapping a row navigates to /v2/insurance/<slug>.
 *   - No DB writes; this is a pure browse surface. The "Save my
 *     plan" flow lives at /v2/insurance/setup.
 *
 * Voice: NC short and kind. No em-dashes anywhere.
 */
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { Card } from '@/v2/components/primitives'
import {
  INSURANCE_PLAN_DEFINITIONS,
  type InsurancePlanDefinition,
} from '@/lib/api/insurance'
import SectionHeading from './SectionHeading'

const CATEGORY_LABELS: Record<NonNullable<InsurancePlanDefinition['category']>, string> = {
  private: 'Private carriers',
  government: 'Government programs',
  other: 'Other',
}

function CarrierRow({ plan }: { plan: InsurancePlanDefinition }) {
  return (
    <Link
      href={`/v2/insurance/${plan.slug}`}
      style={{
        display: 'block',
        padding: 'var(--v2-space-3)',
        borderRadius: 'var(--v2-radius-md)',
        border: '1px solid var(--v2-border-subtle)',
        textDecoration: 'none',
        color: 'inherit',
        background: 'var(--v2-bg-surface)',
        transition: 'background-color 120ms ease',
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-base)',
          fontWeight: 'var(--v2-weight-medium)',
          color: 'var(--v2-text-primary)',
        }}
      >
        {plan.label}
      </p>
      <p
        style={{
          margin: 'var(--v2-space-1) 0 0',
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-text-secondary)',
          lineHeight: 'var(--v2-leading-relaxed)',
        }}
      >
        {plan.description}
      </p>
    </Link>
  )
}

export default function CarrierBrowser() {
  const [query, setQuery] = useState('')

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase()
    const eligible = INSURANCE_PLAN_DEFINITIONS.filter((p) => p.hasContentPage)

    const matched = q
      ? eligible.filter(
          (p) =>
            p.label.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q),
        )
      : eligible

    const out: Record<string, InsurancePlanDefinition[]> = {
      private: [],
      government: [],
      other: [],
    }
    for (const plan of matched) {
      const key = plan.category ?? 'other'
      out[key].push(plan)
    }
    return out
  }, [query])

  const totalMatches = grouped.private.length + grouped.government.length + grouped.other.length

  return (
    <Card>
      <SectionHeading level="h2">Browse all carriers</SectionHeading>
      <p
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-sm)',
          color: 'var(--v2-text-secondary)',
          lineHeight: 'var(--v2-leading-relaxed)',
        }}
      >
        Tap any carrier to open its guide. Each guide covers network,
        referrals, prior auth, appeals, and chronic illness specifics.
      </p>

      <div
        style={{
          marginTop: 'var(--v2-space-3)',
          position: 'relative',
        }}
      >
        <Search
          size={16}
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 'var(--v2-space-3)',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--v2-text-muted)',
            pointerEvents: 'none',
          }}
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find your insurance"
          aria-label="Find your insurance"
          style={{
            width: '100%',
            minHeight: 'var(--v2-touch-target-min)',
            padding: '0 var(--v2-space-3) 0 calc(var(--v2-space-3) + 20px + var(--v2-space-2))',
            borderRadius: 'var(--v2-radius-md)',
            border: '1px solid var(--v2-border-subtle)',
            background: 'var(--v2-bg-surface)',
            color: 'var(--v2-text-primary)',
            fontSize: 'var(--v2-text-base)',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {totalMatches === 0 && (
        <p
          style={{
            margin: 'var(--v2-space-3) 0 0',
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-muted)',
            lineHeight: 'var(--v2-leading-relaxed)',
          }}
        >
          No carriers match. Try a shorter search, or pick &quot;Other / I will add it later&quot; on
          the{' '}
          <Link
            href="/v2/insurance/setup"
            style={{ color: 'var(--v2-accent-primary)', textDecoration: 'none' }}
          >
            setup page
          </Link>
          .
        </p>
      )}

      {(['private', 'government', 'other'] as const).map((cat) => {
        const items = grouped[cat]
        if (items.length === 0) return null
        return (
          <div key={cat} style={{ marginTop: 'var(--v2-space-4)' }}>
            <SectionHeading level="h3">{CATEGORY_LABELS[cat]}</SectionHeading>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--v2-space-2)',
                marginTop: 'var(--v2-space-2)',
              }}
            >
              {items.map((plan) => (
                <CarrierRow key={plan.slug} plan={plan} />
              ))}
            </div>
          </div>
        )
      })}
    </Card>
  )
}
