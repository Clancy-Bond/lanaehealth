/**
 * ShortcutsGrid
 *
 * 2x2 grid of quick-nav cards on home. These replace legacy
 * QuickActions; the v2 chrome uses fewer, larger targets to respect
 * thumb reach on 6.1" iPhones.
 */
import Link from 'next/link'
import { Card } from '@/v2/components/primitives'

interface Shortcut {
  href: string
  label: string
  subtext: string
  color: string
}

const SHORTCUTS: Shortcut[] = [
  {
    href: '/v2/log',
    label: 'Log today',
    subtext: 'Pain, mood, sleep, symptoms',
    color: 'var(--v2-accent-primary)',
  },
  {
    href: '/v2/patterns',
    label: 'Patterns',
    subtext: 'What your data is showing',
    color: 'var(--v2-ring-sleep)',
  },
  {
    href: '/v2/cycle',
    label: 'Cycle',
    subtext: 'Where you are today',
    color: 'var(--v2-surface-explanatory-accent)',
  },
  {
    href: '/v2/timeline',
    label: 'Timeline',
    subtext: 'Your medical history',
    color: 'var(--v2-accent-highlight)',
  },
]

export default function ShortcutsGrid() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 'var(--v2-space-3)',
      }}
    >
      {SHORTCUTS.map((s) => (
        <Link key={s.href} href={s.href} style={{ textDecoration: 'none', color: 'inherit' }}>
          <Card padding="md" style={{ minHeight: 92, display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-1)' }}>
            <span
              style={{
                fontSize: 'var(--v2-text-xs)',
                color: s.color,
                textTransform: 'uppercase',
                letterSpacing: 'var(--v2-tracking-wide)',
                fontWeight: 'var(--v2-weight-semibold)',
              }}
            >
              {s.label}
            </span>
            <span
              style={{
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-secondary)',
                lineHeight: 'var(--v2-leading-normal)',
              }}
            >
              {s.subtext}
            </span>
          </Card>
        </Link>
      ))}
    </div>
  )
}
