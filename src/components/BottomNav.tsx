"use client";

/**
 * Bottom Navigation Bar (mobile)
 *
 * Six-slot layout: [Home] [Calories] [Cycle] [+FAB] [Symptoms] [More].
 * The FAB is route-aware: it reads fab from the active tab in NavConfig
 * and either navigates to the contextual add route, or opens the
 * QuickAddSheet on Home. On tabs without a fab descriptor, it hides.
 *
 * Tab list comes from NAV_TABS; to add/rename a tab edit
 * src/lib/nav/config.ts, not this file.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MoreHorizontal,
  Plus,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  NAV_TABS,
  getFabForPath,
  getTabForPath,
  type NavTab,
  type NavTabId,
} from "@/lib/nav/config";
import { QuickAddSheet } from "@/components/nav/QuickAddSheet";

// Tabs that appear as discrete slots in the mobile bottom bar.
// The rest (also primary: true in config) collapse into More on mobile.
const MOBILE_BOTTOM_TAB_IDS: readonly NavTabId[] = [
  "home",
  "calories",
  "cycle",
  "symptoms",
];

// Everything not in MOBILE_BOTTOM_TAB_IDS lives in the More menu.
function moreMenuTabs(): NavTab[] {
  return NAV_TABS.filter(
    (t) => !MOBILE_BOTTOM_TAB_IDS.includes(t.id),
  );
}

export function BottomNav() {
  const pathname = usePathname() ?? "/";
  const [moreOpen, setMoreOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [hiddenModules, setHiddenModules] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((data) => {
        const enabled = new Set<string>(data.enabledModules ?? []);
        const hidden: string[] = [];
        if (!enabled.has("labs") && !enabled.has("vitals")) hidden.push("/imaging");
        setHiddenModules(hidden);
      })
      .catch(() => {
        // Preferences are a nice-to-have; fail silent.
      });
  }, []);

  const activeTab = getTabForPath(pathname);
  const fab = getFabForPath(pathname);
  const isHomeTab = activeTab?.id === "home";

  const isActive = useCallback(
    (tab: NavTab) => activeTab?.id === tab.id,
    [activeTab],
  );

  const moreTabs = moreMenuTabs().filter(
    (t) => !hiddenModules.includes(t.href),
  );
  const moreIsActive = activeTab != null && moreTabs.some((t) => t.id === activeTab.id);

  const bottomTabs: NavTab[] = MOBILE_BOTTOM_TAB_IDS.map(
    (id) => NAV_TABS.find((t) => t.id === id)!,
  );

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{
          background: "rgba(0, 0, 0, 0.4)",
          opacity: moreOpen ? 1 : 0,
          pointerEvents: moreOpen ? "auto" : "none",
          transition: "opacity 200ms ease",
        }}
        onClick={() => setMoreOpen(false)}
        aria-hidden={!moreOpen}
      />

      <div
        className="fixed left-0 right-0 z-45"
        style={{
          bottom: "calc(var(--nav-height) + var(--safe-bottom))",
          transform: moreOpen ? "translateY(0)" : "translateY(16px)",
          opacity: moreOpen ? 1 : 0,
          pointerEvents: moreOpen ? "auto" : "none",
          transition: "transform 200ms ease, opacity 200ms ease",
          zIndex: 45,
        }}
      >
        <div
          className="mx-3 rounded-2xl overflow-hidden"
          style={{
            background: "var(--bg-card)",
            boxShadow: "var(--shadow-lg)",
            border: "1px solid var(--border-light)",
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: "1px solid var(--border-light)" }}
          >
            <span
              className="text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              More
            </span>
            <button
              onClick={() => setMoreOpen(false)}
              className="touch-target"
              aria-label="Close menu"
            >
              <X size={18} style={{ color: "var(--text-muted)" }} />
            </button>
          </div>
          <nav role="menu" aria-label="More navigation options">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMoreOpen(false);
                window.dispatchEvent(new CustomEvent("lh:open-palette"));
              }}
              className="flex items-center gap-3 px-4 w-full"
              style={{
                height: 48,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--text-primary)",
                transition: "background 150ms ease",
                borderBottom: "1px solid var(--border-light)",
                textAlign: "left",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--bg-elevated)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
              aria-label="Open quick search"
            >
              <Search size={20} strokeWidth={2} />
              <span className="text-sm" style={{ fontWeight: 500 }}>
                Search labs, problems, anything
              </span>
              <kbd
                style={{
                  marginLeft: "auto",
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: "var(--bg-elevated)",
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-mono, monospace)",
                }}
              >
                K
              </kbd>
            </button>
            {moreTabs.map((tab) => {
              const Icon: LucideIcon = tab.icon;
              const active = isActive(tab);
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  role="menuitem"
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-3 px-4"
                  style={{
                    height: 48,
                    color: active ? "var(--accent-sage)" : "var(--text-primary)",
                    transition: "background 150ms ease",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--bg-elevated)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                  <span
                    className="text-sm"
                    style={{ fontWeight: active ? 600 : 400 }}
                  >
                    {tab.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 nav-glass bottom-nav-mobile-only"
        style={{
          paddingBottom: "var(--safe-bottom)",
        }}
        aria-label="Main navigation"
      >
        <div
          className="flex items-center justify-around"
          style={{ height: "var(--nav-height)" }}
        >
          {/* First half of bottom tabs (Home + Calories) */}
          {bottomTabs.slice(0, 2).map((tab) => {
            const Icon: LucideIcon = tab.icon;
            const active = isActive(tab);
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className="flex flex-col items-center justify-center gap-1 touch-target"
                style={{
                  color: active ? "var(--accent-sage)" : "var(--text-muted)",
                  transition: "color 150ms ease",
                  textDecoration: "none",
                }}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={24} strokeWidth={active ? 2.5 : 2} />
                <span
                  style={{
                    fontSize: 10,
                    lineHeight: 1,
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}

          {/* Center slot: Cycle tab, with FAB floating above */}
          {bottomTabs[2] && (
            <Link
              key={bottomTabs[2].id}
              href={bottomTabs[2].href}
              className="flex flex-col items-center justify-center gap-1 touch-target"
              style={{
                color: isActive(bottomTabs[2])
                  ? "var(--accent-sage)"
                  : "var(--text-muted)",
                transition: "color 150ms ease",
                textDecoration: "none",
              }}
              aria-current={isActive(bottomTabs[2]) ? "page" : undefined}
            >
              {(() => {
                const Icon = bottomTabs[2].icon;
                return (
                  <Icon
                    size={24}
                    strokeWidth={isActive(bottomTabs[2]) ? 2.5 : 2}
                  />
                );
              })()}
              <span
                style={{
                  fontSize: 10,
                  lineHeight: 1,
                  fontWeight: isActive(bottomTabs[2]) ? 600 : 400,
                }}
              >
                {bottomTabs[2].label}
              </span>
            </Link>
          )}

          {/* FAB (floating) */}
          {(isHomeTab || fab) && (
            <ContextualFab
              isHome={isHomeTab}
              fabHref={fab?.href ?? null}
              fabLabel={fab?.label ?? "Add"}
              sheetOpen={quickAddOpen}
              onToggleSheet={() => setQuickAddOpen((o) => !o)}
            />
          )}
          {!isHomeTab && !fab && (
            <span aria-hidden style={{ width: 54, height: 54 }} />
          )}

          {/* Second half: Symptoms */}
          {bottomTabs[3] && (
            <Link
              key={bottomTabs[3].id}
              href={bottomTabs[3].href}
              className="flex flex-col items-center justify-center gap-1 touch-target"
              style={{
                color: isActive(bottomTabs[3])
                  ? "var(--accent-sage)"
                  : "var(--text-muted)",
                transition: "color 150ms ease",
                textDecoration: "none",
              }}
              aria-current={isActive(bottomTabs[3]) ? "page" : undefined}
            >
              {(() => {
                const Icon = bottomTabs[3].icon;
                return (
                  <Icon
                    size={24}
                    strokeWidth={isActive(bottomTabs[3]) ? 2.5 : 2}
                  />
                );
              })()}
              <span
                style={{
                  fontSize: 10,
                  lineHeight: 1,
                  fontWeight: isActive(bottomTabs[3]) ? 600 : 400,
                }}
              >
                {bottomTabs[3].label}
              </span>
            </Link>
          )}

          {/* More button */}
          <button
            onClick={() => setMoreOpen((prev) => !prev)}
            className="flex flex-col items-center justify-center gap-1 touch-target"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color:
                moreOpen || moreIsActive
                  ? "var(--accent-sage)"
                  : "var(--text-muted)",
              transition: "color 150ms ease",
            }}
            aria-expanded={moreOpen}
            aria-haspopup="true"
            aria-label="More options"
          >
            <MoreHorizontal
              size={24}
              strokeWidth={moreOpen || moreIsActive ? 2.5 : 2}
            />
            <span
              style={{
                fontSize: 10,
                lineHeight: 1,
                fontWeight: moreOpen || moreIsActive ? 600 : 400,
              }}
            >
              More
            </span>
          </button>
        </div>
      </nav>

      <QuickAddSheet open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
    </>
  );
}

/**
 * Route-aware floating action button. On Home it opens the multi-action
 * QuickAddSheet. On a clone tab with a declared fab, it navigates.
 */
function ContextualFab({
  isHome,
  fabHref,
  fabLabel,
  sheetOpen,
  onToggleSheet,
}: {
  isHome: boolean;
  fabHref: string | null;
  fabLabel: string;
  sheetOpen: boolean;
  onToggleSheet: () => void;
}) {
  const bubble = (
    <div
      className="log-btn-pulse"
      style={{
        width: 54,
        height: 54,
        borderRadius: "50%",
        background:
          "linear-gradient(135deg, #7CA391 0%, #6B9080 50%, #5D7E6F 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: sheetOpen
          ? "translateY(-10px) rotate(45deg)"
          : "translateY(-10px)",
        transition: "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        boxShadow:
          "0 2px 4px rgba(107,144,128,0.25), 0 8px 20px rgba(107,144,128,0.4), inset 0 1px 0 rgba(255,255,255,0.15)",
      }}
    >
      <Plus size={26} color="#FFFFFF" strokeWidth={2.75} />
    </div>
  );

  if (isHome) {
    return (
      <button
        type="button"
        onClick={onToggleSheet}
        className="flex flex-col items-center justify-center touch-target"
        style={{
          position: "relative",
          background: "none",
          border: "none",
          cursor: "pointer",
        }}
        aria-label="Quick add"
        aria-haspopup="true"
        aria-expanded={sheetOpen}
      >
        {bubble}
      </button>
    );
  }

  if (fabHref) {
    return (
      <Link
        href={fabHref}
        className="flex flex-col items-center justify-center touch-target"
        style={{
          position: "relative",
          textDecoration: "none",
        }}
        aria-label={fabLabel}
      >
        {bubble}
      </Link>
    );
  }

  return null;
}
