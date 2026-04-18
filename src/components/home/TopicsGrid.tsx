/**
 * Topics Grid (Home)
 *
 * Discoverable navigation to the /topics/* anchor pages. Each topic
 * is a condition or metric Lanae tracks that has its own deep-dive
 * page. Mirrors Oura's top-nav anchors (Sleep / Heart / Stress /
 * Women's Health / Activity) and Bearable's condition-specific
 * landing pages (ADHD / BPD / depression / chronic-pain).
 *
 * Server component. Four tiles, fixed list for now. Expand when
 * new /topics/* pages ship.
 */

interface Topic {
  href: string;
  label: string;
  blurb: string;
  accent: string;
  icon: string; // simple unicode glyph, avoids shipping an icon font
}

const TOPICS: Topic[] = [
  {
    href: '/topics/orthostatic',
    label: 'Orthostatic',
    blurb: 'POTS tracking, diagnostic progress',
    accent: 'var(--accent-sage)',
    icon: '\u2197',
  },
  {
    href: '/topics/migraine',
    label: 'Migraine',
    blurb: 'Attack frequency, ICHD-3 threshold',
    accent: 'var(--accent-blush)',
    icon: '\u26A1',
  },
  {
    href: '/topics/cycle',
    label: 'Cycle',
    blurb: 'Day, phase, length history',
    accent: 'var(--phase-luteal)',
    icon: '\u25D0',
  },
  {
    href: '/topics/nutrition',
    label: 'Nutrition',
    blurb: 'Calories, macros, trigger foods',
    accent: 'var(--accent-sage-muted)',
    icon: '\u273F',
  },
];

export function TopicsGrid() {
  return (
    <div style={{ padding: '0 16px' }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: 8,
        }}
      >
        Topics
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 8,
        }}
      >
        {TOPICS.map((t) => (
          <a
            key={t.href}
            href={t.href}
            className="press-feedback"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              padding: '12px 14px',
              borderRadius: 12,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderLeftWidth: 3,
              borderLeftStyle: 'solid',
              borderLeftColor: t.accent,
              boxShadow: 'var(--shadow-sm)',
              textDecoration: 'none',
              color: 'var(--text-primary)',
              minHeight: 68,
              transition:
                'transform var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700 }}>{t.label}</span>
              <span style={{ fontSize: 15, color: t.accent }} aria-hidden>
                {t.icon}
              </span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {t.blurb}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
