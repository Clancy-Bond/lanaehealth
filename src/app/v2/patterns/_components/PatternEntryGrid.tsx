/**
 * PatternEntryGrid
 *
 * 2x2 navigation grid for the patterns hub. Each tile leads to a
 * focused view. This is the one-click map from "your patterns" to
 * the specific domain the reader wants to investigate.
 *
 * Each tile renders on a faint domain-tinted gradient so the four
 * surfaces feel like distinct destinations rather than four identical
 * cards. Mirrors Oura's Insights drill-down tiles where the chip color
 * leaks into the card surface (frame_0050 family).
 */
import Link from 'next/link'
import { Card } from '@/v2/components/primitives'

interface Entry {
  href: string
  label: string
  subtext: string
  /** Accent color shown on the chip and used to tint the card. */
  chipColor: string
  /** Two-stop gradient seed used as a soft wash behind the tile. */
  gradientFrom: string
}

const ENTRIES: Entry[] = [
  {
    href: '/v2/patterns/cycle',
    label: 'Cycle',
    subtext: 'Predictions, phase effects, migraine ties',
    chipColor: 'var(--v2-surface-explanatory-accent)',
    gradientFrom: 'rgba(232, 168, 168, 0.10)',
  },
  {
    href: '/v2/patterns/calories',
    label: 'Food',
    subtext: '30-day energy balance and triggers',
    chipColor: 'var(--v2-accent-highlight)',
    gradientFrom: 'rgba(245, 197, 90, 0.10)',
  },
  {
    href: '/v2/sleep',
    label: 'Sleep',
    subtext: 'Recovery trends and contributors',
    chipColor: 'var(--v2-ring-sleep)',
    gradientFrom: 'rgba(155, 127, 224, 0.10)',
  },
  {
    href: '/labs',
    label: 'Labs',
    subtext: 'Recent bloodwork, handled in legacy view',
    chipColor: 'var(--v2-accent-primary)',
    gradientFrom: 'rgba(77, 184, 168, 0.10)',
  },
]

export default function PatternEntryGrid() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--v2-space-3)' }}>
      {ENTRIES.map((e) => (
        <Link key={e.href} href={e.href} style={{ textDecoration: 'none', color: 'inherit' }}>
          <Card
            padding="md"
            style={{
              minHeight: 96,
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--v2-space-1)',
              background: `linear-gradient(140deg, ${e.gradientFrom} 0%, rgba(23, 23, 27, 0) 70%), var(--v2-bg-card)`,
            }}
          >
            <span
              style={{
                fontSize: 'var(--v2-text-xs)',
                color: e.chipColor,
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
