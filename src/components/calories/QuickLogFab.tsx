/**
 * QuickLogFab - MyNetDiary parity (GAP #13)
 *
 * Floating "+" button on /calories that opens a 6-item menu:
 *   Log Breakfast / Lunch / Dinner / Snacks / Exercise / Enter Body Weight
 *
 * Pure HTML <details> so no client JS is required. Positioned fixed
 * bottom-right on mobile, absolute top-right on the dashboard card
 * on desktop. The menu closes when any item is clicked (because the
 * link navigates away; the page reload resets details state).
 */

import Link from "next/link";

interface Item {
  label: string;
  href: string;
}

const ITEMS: Item[] = [
  { label: "Log Breakfast", href: "/calories/search?view=search&meal=breakfast" },
  { label: "Log Lunch", href: "/calories/search?view=search&meal=lunch" },
  { label: "Log Dinner", href: "/calories/search?view=search&meal=dinner" },
  { label: "Log Snacks", href: "/calories/search?view=search&meal=snack" },
  { label: "Log Exercise", href: "/log" },
  { label: "Enter Body Weight", href: "/calories/health/weight" },
];

export function QuickLogFab() {
  return (
    <details
      className="quick-log-fab"
      style={{
        position: "fixed",
        bottom: 88, // above BottomNav on mobile
        right: 20,
        zIndex: 50,
      }}
    >
      <summary
        aria-label="Quick log menu"
        style={{
          listStyle: "none",
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "var(--accent-sage)",
          color: "var(--text-inverse)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 32,
          fontWeight: 800,
          cursor: "pointer",
          boxShadow: "0 6px 20px rgba(107,144,128,0.4)",
          userSelect: "none",
        }}
      >
        +
      </summary>
      <nav
        style={{
          position: "absolute",
          bottom: 66,
          right: 0,
          minWidth: 200,
          padding: 6,
          borderRadius: 12,
          background: "white",
          border: "1px solid var(--border-light)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {ITEMS.map((i) => (
          <Link
            key={i.href + i.label}
            href={i.href}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            {i.label}
          </Link>
        ))}
      </nav>
      <style>{`
        .quick-log-fab summary::-webkit-details-marker { display: none; }
        .quick-log-fab summary::marker { content: ''; }
        .quick-log-fab nav a:hover { background: var(--accent-sage-muted); }
        @media (min-width: 1024px) {
          .quick-log-fab { bottom: 28px; right: 28px; }
        }
      `}</style>
    </details>
  );
}
