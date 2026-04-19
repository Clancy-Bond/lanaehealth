"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Home,
  BarChart3,
  Plus,
  FolderOpen,
  MoreHorizontal,
  Stethoscope,
  MessageSquare,
  Clock,
  User,
  Settings,
  Monitor,
  Sparkles,
  Search,
  Receipt,
  X,
} from "lucide-react";
import { QuickAddSheet } from "@/components/nav/QuickAddSheet";

interface NavItem {
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  href: string;
}

const mainTabs: NavItem[] = [
  { label: "Today", icon: Home, href: "/" },
  { label: "Patterns", icon: BarChart3, href: "/patterns" },
  { label: "Add", icon: Plus, href: "#add" },
  { label: "Records", icon: FolderOpen, href: "/records" },
  { label: "More", icon: MoreHorizontal, href: "#more" },
];

const moreMenuItems: NavItem[] = [
  { label: "Intelligence", icon: Sparkles, href: "/intelligence" },
  { label: "Doctor Mode", icon: Stethoscope, href: "/doctor" },
  { label: "AI Research", icon: MessageSquare, href: "/chat" },
  { label: "Imaging Viewer", icon: Monitor, href: "/imaging" },
  { label: "Timeline", icon: Clock, href: "/timeline" },
  { label: "Expenses", icon: Receipt, href: "/expenses" },
  { label: "Profile", icon: User, href: "/profile" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [hiddenModules, setHiddenModules] = useState<string[]>([]);

  // Fetch user preferences to determine which modules are hidden
  useEffect(() => {
    fetch('/api/preferences')
      .then(r => r.json())
      .then(data => {
        const enabled = new Set(data.enabledModules ?? []);
        // Map modules to more menu items that should be hidden
        const hidden: string[] = [];
        if (!enabled.has('labs') && !enabled.has('vitals')) hidden.push('/imaging');
        // Settings, Profile, Doctor Mode, Chat, Timeline are always shown
        setHiddenModules(hidden);
      })
      .catch(() => {});
  }, []);

  const isActive = useCallback(
    (href: string) => {
      if (href === "/") return pathname === "/";
      return pathname.startsWith(href);
    },
    [pathname]
  );

  const moreIsActive =
    !isActive("/") &&
    !isActive("/patterns") &&
    !isActive("/log") &&
    !isActive("/records") &&
    moreMenuItems.some((item) => isActive(item.href));

  return (
    <>
      {/* More menu overlay */}
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

      {/* More menu panel */}
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
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              aria-label="Open quick search"
            >
              <Search size={20} strokeWidth={2} />
              <span className="text-sm" style={{ fontWeight: 500 }}>Search labs, problems, anything</span>
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
            {moreMenuItems.filter(item => !hiddenModules.includes(item.href)).map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-3 px-4"
                  style={{
                    height: 48,
                    color: active
                      ? "var(--accent-sage)"
                      : "var(--text-primary)",
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
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom navigation bar -- frosted glass */}
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
          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            const isAdd = tab.label === "Add";
            const isMore = tab.label === "More";

            if (isAdd) {
              return (
                <button
                  key="add-button"
                  type="button"
                  onClick={() => setQuickAddOpen((o) => !o)}
                  className="flex flex-col items-center justify-center touch-target"
                  style={{
                    position: "relative",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                  aria-label="Quick add"
                  aria-haspopup="true"
                  aria-expanded={quickAddOpen}
                >
                  <div
                    className="log-btn-pulse"
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #7CA391 0%, #6B9080 50%, #5D7E6F 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transform: quickAddOpen
                        ? "translateY(-10px) rotate(45deg)"
                        : "translateY(-10px)",
                      transition: "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
                      boxShadow: "0 2px 4px rgba(107,144,128,0.25), 0 8px 20px rgba(107,144,128,0.4), inset 0 1px 0 rgba(255,255,255,0.15)",
                    }}
                  >
                    <Plus size={26} color="#FFFFFF" strokeWidth={2.75} />
                  </div>
                </button>
              );
            }

            if (isMore) {
              const active = moreOpen || moreIsActive;
              return (
                <button
                  key="more-button"
                  onClick={() => setMoreOpen((prev) => !prev)}
                  className="flex flex-col items-center justify-center gap-1 touch-target"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: active
                      ? "var(--accent-sage)"
                      : "var(--text-muted)",
                    transition: "color 150ms ease",
                  }}
                  aria-expanded={moreOpen}
                  aria-haspopup="true"
                  aria-label="More options"
                >
                  <MoreHorizontal size={24} strokeWidth={active ? 2.5 : 2} />
                  <span
                    style={{
                      fontSize: 10,
                      lineHeight: 1,
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    More
                  </span>
                </button>
              );
            }

            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex flex-col items-center justify-center gap-1 touch-target"
                style={{
                  color: active
                    ? "var(--accent-sage)"
                    : "var(--text-muted)",
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
        </div>
      </nav>

      <QuickAddSheet open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
    </>
  );
}
