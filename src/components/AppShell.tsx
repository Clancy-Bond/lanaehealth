"use client";

import { BottomNav } from "./BottomNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ background: "var(--bg-primary)" }}
    >
      <main className="flex-1 overflow-y-auto pb-safe">{children}</main>
      <BottomNav />
    </div>
  );
}
