"use client";

/**
 * Top Navigation Bar
 *
 * Desktop-first horizontal nav across the top of every non-onboarding
 * page. Complements the mobile-first BottomNav so Lanae has both
 * access patterns depending on device. Shown on ≥768px viewports.
 *
 * Tabs (matching Clancy's request 2026-04-17):
 *   Home / Calories / Doctor / Symptoms / Cycle / Labs / Patterns / Imaging
 *
 * Active tab detected by pathname. Each tab deep-links to the primary
 * route for that concern.
 */

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Home as HomeIcon,
  Apple,
  Stethoscope,
  ClipboardList,
  CircleDot,
  FlaskConical,
  BarChart3,
  Monitor,
} from "lucide-react";

interface Tab {
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  href: string;
  /** Extra pathname prefixes that should mark this tab as active. */
  matchPrefixes?: string[];
}

const TABS: Tab[] = [
  { label: "Home", icon: HomeIcon, href: "/" },
  {
    label: "Calories",
    icon: Apple,
    href: "/calories",
    matchPrefixes: ["/calories", "/topics/nutrition"],
  },
  { label: "Doctor", icon: Stethoscope, href: "/doctor" },
  {
    label: "Symptoms",
    icon: ClipboardList,
    href: "/log",
    matchPrefixes: ["/log", "/topics/orthostatic", "/topics/migraine"],
  },
  {
    label: "Cycle",
    icon: CircleDot,
    href: "/topics/cycle",
    matchPrefixes: ["/topics/cycle"],
  },
  { label: "Labs", icon: FlaskConical, href: "/records" },
  {
    label: "Patterns",
    icon: BarChart3,
    href: "/patterns",
    matchPrefixes: ["/patterns", "/intelligence"],
  },
  { label: "Imaging", icon: Monitor, href: "/imaging" },
];

function isActive(pathname: string, tab: Tab): boolean {
  if (tab.href === "/" && pathname === "/") return true;
  if (tab.href === "/" && pathname !== "/") return false;
  if (pathname === tab.href) return true;
  if (tab.matchPrefixes) {
    return tab.matchPrefixes.some((p) => pathname.startsWith(p));
  }
  return pathname.startsWith(tab.href);
}

export function TopNav() {
  const pathname = usePathname() ?? "/";

  return (
    <nav
      aria-label="Primary"
      className="top-nav"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: "rgba(250, 250, 247, 0.92)",
        backdropFilter: "saturate(140%) blur(10px)",
        WebkitBackdropFilter: "saturate(140%) blur(10px)",
        borderBottom: "1px solid var(--border-light)",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        {/* Brand */}
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: "-0.01em",
            color: "var(--text-primary)",
            textDecoration: "none",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              background:
                "linear-gradient(135deg, var(--accent-sage) 0%, var(--phase-follicular) 100%)",
              display: "inline-block",
            }}
          />
          LanaeHealth
        </Link>

        {/* Tab strip: horizontally scrollable on narrow viewports. */}
        <div
          className="top-nav-tabs"
          style={{
            flex: 1,
            display: "flex",
            gap: 2,
            overflowX: "auto",
            scrollbarWidth: "none",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {TABS.map((tab) => {
            const active = isActive(pathname, tab);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  color: active ? "var(--text-inverse)" : "var(--text-secondary)",
                  background: active ? "var(--accent-sage)" : "transparent",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                <Icon size={14} strokeWidth={active ? 2.5 : 2} />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
      <style>{`
        .top-nav-tabs::-webkit-scrollbar { display: none; }
        @media (max-width: 767px) {
          .top-nav { display: none; }
        }
      `}</style>
    </nav>
  );
}
