/*
 * QuickLogFabV2
 *
 * Floating action button with a pure-HTML <details>/<summary>
 * popover. Six quick-log shortcuts: Log breakfast / lunch / dinner /
 * snacks / exercise / weight. Each menu item is a Next.js <Link>;
 * navigation resets the <details> state so the menu closes on click
 * without any client JS.
 *
 * Positioning mirrors the v2 FAB shell primitive (bottom-right above
 * the safe-area inset). We don't use the shell FAB component because
 * its `variant="floating"` requires an onClick, and we want the
 * anchor-child popover pattern.
 */
import Link from 'next/link'

interface QuickLogItem {
  label: string
  href: string
}

const ITEMS: QuickLogItem[] = [
  { label: 'Log breakfast', href: '/v2/calories/search?view=search&meal=breakfast' },
  { label: 'Log lunch', href: '/v2/calories/search?view=search&meal=lunch' },
  { label: 'Log dinner', href: '/v2/calories/search?view=search&meal=dinner' },
  { label: 'Log snacks', href: '/v2/calories/search?view=search&meal=snack' },
  { label: 'Log photo', href: '/v2/calories/photo' },
  { label: 'Scan barcode', href: '/v2/calories/search?view=scan' },
  { label: 'Log exercise', href: '/v2/calories/plan?view=exercise' },
  { label: 'Log weight', href: '/v2/calories/plan?view=weight' },
]

export default function QuickLogFabV2() {
  return (
    <details
      className="v2-quick-log-fab"
      style={{
        position: 'fixed',
        right: 'calc(var(--v2-space-4) + var(--v2-safe-right))',
        bottom: 'calc(var(--v2-space-4) + var(--v2-safe-bottom))',
        zIndex: 40,
      }}
    >
      <summary
        aria-label="Quick log menu"
        style={{
          listStyle: 'none',
          width: 'var(--v2-fab-size)',
          height: 'var(--v2-fab-size)',
          borderRadius: 'var(--v2-radius-full)',
          background: 'var(--v2-accent-primary)',
          color: 'var(--v2-on-accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
          fontWeight: 'var(--v2-weight-semibold)',
          cursor: 'pointer',
          boxShadow: 'var(--v2-shadow-lg)',
          userSelect: 'none',
        }}
      >
        +
      </summary>
      <nav
        aria-label="Quick log options"
        style={{
          position: 'absolute',
          right: 0,
          bottom: 'calc(var(--v2-fab-size) + var(--v2-space-2))',
          minWidth: 224,
          padding: 'var(--v2-space-1)',
          borderRadius: 'var(--v2-radius-md)',
          background: 'var(--v2-bg-elevated)',
          border: '1px solid var(--v2-border)',
          boxShadow: 'var(--v2-shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {ITEMS.map((item) => (
          <Link
            key={item.href + item.label}
            href={item.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              minHeight: 'var(--v2-touch-target-min)',
              padding: 'var(--v2-space-2) var(--v2-space-3)',
              borderRadius: 'var(--v2-radius-sm)',
              textDecoration: 'none',
              fontSize: 'var(--v2-text-sm)',
              fontWeight: 'var(--v2-weight-medium)',
              color: 'var(--v2-text-primary)',
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <style>{`
        .v2-quick-log-fab summary::-webkit-details-marker { display: none; }
        .v2-quick-log-fab summary::marker { content: ''; }
        .v2-quick-log-fab nav a:hover,
        .v2-quick-log-fab nav a:focus-visible {
          background: var(--v2-accent-primary-soft);
          outline: none;
        }
      `}</style>
    </details>
  )
}
