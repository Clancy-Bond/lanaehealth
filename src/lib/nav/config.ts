/**
 * Single source of truth for app navigation.
 *
 * Both TopNav (desktop) and BottomNav (mobile) consume this array, so
 * tab order, labels, icons, and active-state prefixes stay in sync.
 * Each tab can declare its own contextual FAB target; the Plus button
 * on BottomNav reads that descriptor for the current route.
 *
 * Clone sessions (calories/cycle/symptoms/sleep) add at most one line
 * to this file; all other nav edits happen here, not in the components.
 */

import {
  Home,
  Apple,
  CircleDot,
  ClipboardList,
  Moon,
  FolderOpen,
  Stethoscope,
  BarChart3,
  Plus,
  type LucideIcon,
} from "lucide-react";

export type NavTabId =
  | "home"
  | "calories"
  | "cycle"
  | "symptoms"
  | "sleep"
  | "records"
  | "doctor"
  | "patterns";

export interface NavFab {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavTab {
  id: NavTabId;
  label: string;
  icon: LucideIcon;
  href: string;
  /** Extra path prefixes that mark this tab active. Always include the href itself implicitly. */
  matchPrefixes?: string[];
  /** Omit to hide the FAB on this tab (e.g., records/doctor). */
  fab?: NavFab;
  /** Shown in the primary strip; non-primary tabs collapse into the More menu on mobile. */
  primary: boolean;
}

export const NAV_TABS: readonly NavTab[] = [
  {
    id: "home",
    label: "Home",
    icon: Home,
    href: "/",
    primary: true,
  },
  {
    id: "calories",
    label: "Calories",
    icon: Apple,
    href: "/calories",
    matchPrefixes: ["/calories", "/topics/nutrition"],
    fab: { label: "Add meal", href: "/calories/search", icon: Plus },
    primary: true,
  },
  {
    id: "cycle",
    label: "Cycle",
    icon: CircleDot,
    href: "/cycle",
    matchPrefixes: ["/cycle", "/topics/cycle"],
    fab: { label: "Log period", href: "/cycle/log", icon: Plus },
    primary: true,
  },
  {
    id: "symptoms",
    label: "Symptoms",
    icon: ClipboardList,
    href: "/log",
    matchPrefixes: [
      "/log",
      "/symptoms",
      "/topics/orthostatic",
      "/topics/migraine",
    ],
    fab: { label: "Log symptom", href: "/log", icon: Plus },
    primary: true,
  },
  {
    id: "sleep",
    label: "Sleep",
    icon: Moon,
    href: "/sleep",
    fab: { label: "Log sleep", href: "/sleep/log", icon: Plus },
    primary: true,
  },
  {
    id: "records",
    label: "Records",
    icon: FolderOpen,
    href: "/records",
    matchPrefixes: ["/records", "/labs", "/imaging"],
    primary: false,
  },
  {
    id: "doctor",
    label: "Doctor",
    icon: Stethoscope,
    href: "/doctor",
    primary: false,
  },
  {
    id: "patterns",
    label: "Patterns",
    icon: BarChart3,
    href: "/patterns",
    matchPrefixes: ["/patterns", "/intelligence"],
    primary: false,
  },
] as const;

export function getTabForPath(pathname: string): NavTab | null {
  if (pathname === "/") {
    return NAV_TABS.find((t) => t.id === "home") ?? null;
  }
  // Skip home in the loop so /cycle-anything doesn't match home's "/" prefix.
  for (const tab of NAV_TABS) {
    if (tab.id === "home") continue;
    const prefixes = tab.matchPrefixes ?? [tab.href];
    if (prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      return tab;
    }
  }
  return null;
}

export function getFabForPath(pathname: string): NavFab | null {
  const tab = getTabForPath(pathname);
  return tab?.fab ?? null;
}

export const PRIMARY_NAV_TABS = NAV_TABS.filter((t) => t.primary);
export const SECONDARY_NAV_TABS = NAV_TABS.filter((t) => !t.primary);
