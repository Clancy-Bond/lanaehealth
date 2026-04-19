"use client";

/**
 * Top Navigation Bar
 *
 * Desktop-first horizontal nav across the top of every non-onboarding
 * page. Complements the mobile-first BottomNav so Lanae has both access
 * patterns depending on device. Shown on >=768px viewports only (CSS-
 * driven, see style block at bottom of this file).
 *
 * Tabs and active-state prefixes come from the shared NavConfig at
 * src/lib/nav/config.ts. To add or rename a tab, edit that file, not
 * this one.
 */

import { usePathname } from "next/navigation";
import Link from "next/link";
import { NAV_TABS, getTabForPath, type NavTab } from "@/lib/nav/config";

export function TopNav() {
  const pathname = usePathname() ?? "/";
  const activeTab = getTabForPath(pathname);

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
          {NAV_TABS.map((tab: NavTab) => {
            const active = activeTab?.id === tab.id;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.id}
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
