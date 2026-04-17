"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "./BottomNav";
import { CommandPalette } from "./CommandPalette";

const HIDE_NAV_ROUTES = ["/onboarding"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNav = HIDE_NAV_ROUTES.some((r) => pathname.startsWith(r));

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ background: "var(--bg-primary)" }}
    >
      <main id="main-content" className="flex-1 overflow-y-auto pb-safe">{children}</main>
      {!hideNav && <BottomNav />}
      {/* Global command palette, available on every route except onboarding.
          Cmd/Ctrl+K toggles it. Renders nothing until opened. */}
      {!hideNav && <CommandPalette />}
    </div>
  );
}
