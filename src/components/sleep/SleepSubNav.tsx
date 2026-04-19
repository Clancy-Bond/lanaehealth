/**
 * Secondary nav strip shown across every /sleep/* route.
 *
 * Oura's app has four pinned areas (Sleep, Readiness, Trends, Logs); we
 * mirror that so the user can stay inside the sleep tab rather than
 * trailing back through home. The strip is a single ARIA tab set so
 * screen readers can jump between views.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS: { href: string; label: string }[] = [
  { href: '/sleep', label: 'Overview' },
  { href: '/sleep/stages', label: 'Stages' },
  { href: '/sleep/recovery', label: 'Recovery' },
  { href: '/sleep/log', label: 'Log night' },
  { href: '/patterns/sleep', label: 'Trends' },
];

export function SleepSubNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Sleep sections"
      style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        padding: '2px 16px 4px',
        scrollbarWidth: 'none',
      }}
      className="hide-scrollbar"
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={active ? 'pill pill-active' : 'pill'}
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
