/*
 * LegacyLinksCard
 *
 * Static ListRow links out to legacy /settings for the heavier
 * workflows v2 intentionally does not reimplement: connected
 * apps, imports, data export, the AI knowledge base, and the
 * module customizer. Each row is a <Link> to an anchor on the
 * legacy route so the user lands directly on the section they
 * want.
 *
 * Pure server component: no state, no client-side JS.
 */
import Link from 'next/link'
import { Card, ListRow } from '@/v2/components/primitives'

interface LegacyLink {
  href: string
  label: string
  subtext: string
}

const LINKS: LegacyLink[] = [
  {
    href: '/settings#integrations',
    label: 'Connected apps',
    subtext: 'Oura, Dexcom, WHOOP, and more.',
  },
  {
    href: '/settings#imports',
    label: 'Imports',
    subtext: 'Adventist Health, Natural Cycles, Apple Health.',
  },
  {
    href: '/settings#data-export',
    label: 'Data export',
    subtext: 'Download JSON, CSV, or PDF.',
  },
  {
    href: '/settings#ai-knowledge',
    label: 'AI knowledge base',
    subtext: 'Refresh dream, re-index history.',
  },
  {
    href: '/settings#module-customizer',
    label: 'Customize features',
    subtext: 'Toggle what appears in the app.',
  },
]

export default function LegacyLinksCard() {
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
          More settings
        </h2>

        <div>
          {LINKS.map((link, idx) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                display: 'block',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <ListRow
                label={link.label}
                subtext={link.subtext}
                chevron
                divider={idx < LINKS.length - 1}
              />
            </Link>
          ))}
        </div>
      </div>
    </Card>
  )
}
