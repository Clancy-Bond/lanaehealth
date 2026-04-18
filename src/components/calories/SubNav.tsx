/**
 * Sub-nav pill for /calories pages. Mirrors MyNetDiary's top nav
 * (Dashboard / Food / Plan / Analysis / Health / Community / Settings)
 * but keeps the tab set tight to what's already built. Expand as
 * /calories/plan, /calories/analysis, /calories/health ship.
 */

export type CaloriesTab = 'dashboard' | 'food' | 'analysis';

interface Props {
  current: CaloriesTab;
}

const TABS: Array<{ key: CaloriesTab; label: string; href: string; disabled?: boolean }> = [
  { key: 'dashboard', label: 'Dashboard', href: '/calories' },
  { key: 'food', label: 'Food', href: '/calories/food' },
  { key: 'analysis', label: 'Analysis', href: '/calories/analysis' },
];

export function CaloriesSubNav({ current }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        padding: '4px',
        borderRadius: 10,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        width: 'fit-content',
      }}
    >
      {TABS.map((t) => {
        const active = t.key === current;
        const base: React.CSSProperties = {
          padding: '6px 14px',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 700,
          textDecoration: 'none',
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
          opacity: t.disabled ? 0.4 : 1,
          pointerEvents: t.disabled ? 'none' : 'auto',
        };
        const activeStyle: React.CSSProperties = {
          background: 'var(--accent-sage)',
          color: 'var(--text-inverse)',
        };
        const inactive: React.CSSProperties = {
          background: 'transparent',
          color: 'var(--text-secondary)',
        };
        return (
          <a
            key={t.key}
            href={t.href}
            aria-disabled={t.disabled || undefined}
            style={{ ...base, ...(active ? activeStyle : inactive) }}
          >
            {t.label}
            {t.disabled && (
              <span
                style={{
                  fontSize: 9,
                  marginLeft: 4,
                  color: 'var(--text-muted)',
                }}
              >
                soon
              </span>
            )}
          </a>
        );
      })}
    </div>
  );
}
