/**
 * LegalCard
 *
 * Settings deep-links to the three /v2/legal pages: Privacy
 * Policy, Terms of Service, and Cookie Policy. Same shape as
 * LegacyLinksCard so the visual rhythm is consistent.
 *
 * Pure server component: no state, no client-side JS.
 */
import Link from 'next/link'
import { Card, ListRow } from '@/v2/components/primitives'

interface LegalLink {
  href: string
  label: string
  subtext: string
}

const LINKS: LegalLink[] = [
  {
    href: '/v2/legal/privacy',
    label: 'Privacy Policy',
    subtext: 'What we collect, who sees it, how to delete it.',
  },
  {
    href: '/v2/legal/terms',
    label: 'Terms of Service',
    subtext: 'The agreement between you and LanaeHealth.',
  },
  {
    href: '/v2/legal/cookie-policy',
    label: 'Cookie Policy',
    subtext: 'Essential cookies only. No tracking.',
  },
]

export default function LegalCard() {
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
          Legal
        </h2>

        <div>
          {LINKS.map((link, idx) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={false}
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
