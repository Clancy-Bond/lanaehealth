"use client";

import { useState, useCallback } from "react";
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
  X,
} from "lucide-react";

interface NavItem {
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  href: string;
}

const mainTabs: NavItem[] = [
  { label: "Today", icon: Home, href: "/" },
  { label: "Patterns", icon: BarChart3, href: "/patterns" },
  { label: "Log", icon: Plus, href: "/log" },
  { label: "Records", icon: FolderOpen, href: "/records" },
  { label: "More", icon: MoreHorizontal, href: "#more" },
];

const moreMenuItems: NavItem[] = [
  { label: "Doctor Mode", icon: Stethoscope, href: "/doctor" },
  { label: "AI Research", icon: MessageSquare, href: "/chat" },
  { label: "Timeline", icon: Clock, href: "/timeline" },
  { label: "Profile", icon: User, href: "/profile" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

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
            {moreMenuItems.map((item) => {
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

      {/* Bottom navigation bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50"
        style={{
          background: "var(--bg-card)",
          borderTop: "1px solid var(--border)",
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
            const isLog = tab.label === "Log";
            const isMore = tab.label === "More";

            if (isLog) {
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className="flex flex-col items-center justify-center touch-target"
                  style={{ position: "relative" }}
                  aria-label="Log"
                  aria-current={isActive(tab.href) ? "page" : undefined}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      background: "var(--accent-sage)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transform: "translateY(-8px)",
                      boxShadow: "0 4px 12px rgba(107, 144, 128, 0.35)",
                      transition: "transform 150ms ease, box-shadow 150ms ease",
                    }}
                  >
                    <Plus size={24} color="#FFFFFF" strokeWidth={2.5} />
                  </div>
                </Link>
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
    </>
  );
}
