/*
 * InsuranceCard
 *
 * Settings entry point for the v2 insurance navigator. Reads the
 * stored insurance profile (if any) so the row shows the user's
 * current plan rather than a generic label. Tapping the row opens
 * /v2/insurance, which routes to setup if no profile is saved yet.
 *
 * Pure server component: no state, no client-side JS. Mirrors the
 * shape of LegacyLinksCard so settings keeps a single visual language.
 */
import Link from 'next/link'
import {
  getInsuranceProfile,
  getPlanDefinition,
} from '@/lib/api/insurance'
import { Card, ListRow } from '@/v2/components/primitives'

export default async function InsuranceCard() {
  const profile = await getInsuranceProfile()
  const subtext = profile
    ? getPlanDefinition(profile.planSlug).label
    : 'Pick your plan and learn how to navigate it.'

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
          Insurance
        </h2>

        <Link
          href="/v2/insurance"
          style={{
            display: 'block',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <ListRow
            label="My insurance navigator"
            subtext={subtext}
            chevron
            divider={false}
          />
        </Link>
      </div>
    </Card>
  )
}
