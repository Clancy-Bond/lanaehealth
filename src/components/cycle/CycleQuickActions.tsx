/**
 * Quick actions strip for /cycle landing.
 *
 * Four buttons: log period, history, predict, patterns. Each is a Link
 * so keyboard and screen readers get proper semantics.
 */
import Link from 'next/link'
import { NotebookPen, CalendarRange, TrendingUp, LineChart } from 'lucide-react'

const ACTIONS: Array<{ href: string; label: string; caption: string; Icon: typeof NotebookPen }> = [
  { href: '/cycle/log', label: 'Log period', caption: 'Flow, symptoms, LH', Icon: NotebookPen },
  { href: '/cycle/history', label: 'History', caption: 'Past cycles + calendar', Icon: CalendarRange },
  { href: '/cycle/predict', label: 'Predict', caption: 'Next period + window', Icon: TrendingUp },
  { href: '/patterns/cycle', label: 'Patterns', caption: 'Lengths + phase pain', Icon: LineChart },
]

export function CycleQuickActions() {
  return (
    <section
      aria-label="Cycle quick actions"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 10,
      }}
    >
      {ACTIONS.map(({ href, label, caption, Icon }) => (
        <Link
          key={href}
          href={href}
          className="press-feedback"
          style={{
            padding: '14px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            textDecoration: 'none',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            minHeight: 60,
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <span
            aria-hidden
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: 'var(--accent-sage-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon size={16} style={{ color: 'var(--accent-sage)' }} />
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{label}</span>
            <span
              style={{
                display: 'block',
                fontSize: 11,
                color: 'var(--text-muted)',
                marginTop: 1,
              }}
            >
              {caption}
            </span>
          </span>
        </Link>
      ))}
    </section>
  )
}
