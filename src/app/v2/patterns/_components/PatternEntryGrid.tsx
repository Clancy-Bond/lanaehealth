/**
 * PatternEntryGrid
 *
 * 2x2 navigation grid for the patterns hub. Each tile leads to a
 * focused view. This is the one-click map from "your patterns" to
 * the specific domain the reader wants to investigate.
 */
import Link from 'next/link'
import { Card } from '@/v2/components/primitives'

interface Entry {
  href: string
  label: string
  subtext: string
  color: string
}

const ENTRIES: Entry[] = [
  {
    href: '/v2/patterns/cycle',
    label: 'Cycle',
    subtext: 'Predictions, phase effects, migraine ties',
    color: 'var(--v2-surface-explanatory-accent)',
  },
  {
    href: '/v2/patterns/calories',
    label: 'Food',
    subtext: '30-day energy balance and triggers',
    color: 'var(--v2-accent-highlight)',
  },
  {
    href: '/v2/sleep',
    label: 'Sleep',
    subtext: 'Recovery trends and contributors',
    color: 'var(--v2-ring-sleep)',
  },
  {
    href: '/labs',
    label: 'Labs',
    subtext: 'Recent bloodwork, handled in legacy view',
    color: 'var(--v2-accent-primary)',
  },
]

export default function PatternEntryGrid() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--v2-space-3)' }}>
      {ENTRIES.map((e) => (
        <Link key={e.href} href={e.href} style={{ textDecoration: 'none', color: 'inherit' }}>
          <Card padding="md" style={{ minHeight: 96, display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-1)' }}>
            <span
              style={{
                fontSize: 'var(--v2-text-xs)',
                color: e.color,
                textTransform: 'uppercase',
                letterSpacing: 'var(--v2-tracking-wide)',
                fontWeight: 'var(--v2-weight-semibold)',
              }}
            >
              {e.label}
            </span>
            <span style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)', lineHeight: 'var(--v2-leading-normal)' }}>
              {e.subtext}
            </span>
          </Card>
        </Link>
      ))}
    </div>
  )
}
