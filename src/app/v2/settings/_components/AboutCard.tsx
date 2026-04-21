/*
 * AboutCard
 *
 * Static identity strip at the bottom of settings. App name,
 * shipped version (read server-side from package.json), tagline,
 * and one-line subtext. Pure server component: no state, no JS.
 */
import { Card } from '@/v2/components/primitives'

export interface AboutCardProps {
  version: string
}

export default function AboutCard({ version }: AboutCardProps) {
  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 'var(--v2-space-2)',
          }}
        >
          <h2
            style={{
              fontSize: 'var(--v2-text-lg)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
              margin: 0,
            }}
          >
            LanaeHealth
          </h2>
          <span
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-muted)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            v{version}
          </span>
        </div>
        <p
          style={{
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-primary)',
            margin: 0,
          }}
        >
          Health tracking that&apos;s yours to read.
        </p>
        <p
          style={{
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-muted)',
            margin: 0,
          }}
        >
          Doctor visits, simpler.
        </p>
      </div>
    </Card>
  )
}
