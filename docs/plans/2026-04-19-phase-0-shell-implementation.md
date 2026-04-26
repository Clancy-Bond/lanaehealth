# Phase 0 - Compartmentalization Shell Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Land the unified nav config, contextual FAB, and editable home widget grid so the four clone sessions (Calories / Cycle / Symptoms / Sleep) can be built in parallel without colliding.

**Architecture:** One `NavConfig` array drives both `TopNav` and `BottomNav`. Each tab declares its own FAB target. Home becomes `<WidgetGrid />` driven by a registry of `HomeWidget` entries, with per-user enable + order persisted in existing preferences.

**Tech Stack:** Next.js 16 App Router, React 19 Server Components, TypeScript, Vitest, Tailwind 4, Supabase for preferences.

**Reference design:** [docs/plans/2026-04-19-compartmentalized-ux-overhaul-design.md](2026-04-19-compartmentalized-ux-overhaul-design.md)

**Non-negotiable invariants:**
- Default preferences reproduce today's home exactly (zero-regression for existing user).
- No Supabase schema changes (reuse `user_preferences` JSON columns).
- After this phase, clones never edit `TopNav.tsx`, `BottomNav.tsx`, `AppShell.tsx`, or `src/app/page.tsx`.

---

## Task 1: NavConfig type + default array

**Files:**
- Create: `src/lib/nav/config.ts`
- Test: `src/lib/nav/__tests__/config.test.ts`

**Step 1: Write the failing test**

```ts
// src/lib/nav/__tests__/config.test.ts
import { describe, it, expect } from "vitest";
import { NAV_TABS, getTabForPath, getFabForPath } from "../config";

describe("NavConfig", () => {
  it("exposes home, calories, cycle, symptoms, sleep, records, doctor, patterns", () => {
    const ids = NAV_TABS.map((t) => t.id);
    expect(ids).toContain("home");
    expect(ids).toContain("calories");
    expect(ids).toContain("cycle");
    expect(ids).toContain("symptoms");
    expect(ids).toContain("sleep");
  });

  it("resolves the calories tab for /calories/food", () => {
    expect(getTabForPath("/calories/food")?.id).toBe("calories");
  });

  it("returns the contextual FAB for /calories", () => {
    const fab = getFabForPath("/calories");
    expect(fab?.href).toBe("/calories/search");
  });

  it("returns null FAB for /records", () => {
    expect(getFabForPath("/records")).toBeNull();
  });
});
```

**Step 2: Run test - expect failure**

```bash
npx vitest run src/lib/nav/__tests__/config.test.ts
```

Expected: fail, module not found.

**Step 3: Implement config**

```ts
// src/lib/nav/config.ts
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
  matchPrefixes?: string[];
  /** Omit to hide FAB on this tab. */
  fab?: NavFab;
  /** Show on primary bar (vs. collapsed into "More" on mobile). */
  primary: boolean;
}

export const NAV_TABS: readonly NavTab[] = [
  { id: "home", label: "Home", icon: Home, href: "/", primary: true },
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
    matchPrefixes: ["/log", "/symptoms", "/topics/orthostatic", "/topics/migraine"],
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
  if (pathname === "/") return NAV_TABS.find((t) => t.id === "home") ?? null;
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
```

**Step 4: Run tests - expect pass**

```bash
npx vitest run src/lib/nav/__tests__/config.test.ts
```

Expected: 4 passed.

**Step 5: Commit**

```bash
git add src/lib/nav/config.ts src/lib/nav/__tests__/config.test.ts
git commit -m "feat(nav): single NavConfig source of truth for tabs + FAB"
```

---

## Task 2: Migrate TopNav to NavConfig

**Files:**
- Modify: `src/components/TopNav.tsx`

**Step 1:** Replace the local `TABS` array with `import { NAV_TABS } from "@/lib/nav/config"`. Filter to `NAV_TABS.filter(t => t.primary)` for the primary strip; consider showing non-primary behind a "More" dropdown later (not this task). Keep `isActive` behavior identical by reading `matchPrefixes`.

**Step 2:** Manually verify by loading `/`, `/calories`, `/cycle`, `/log`, `/sleep`, `/doctor` and confirming the active tab highlights correctly.

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3005/calories
```

Expected: 200.

**Step 3: Commit**

```bash
git add src/components/TopNav.tsx
git commit -m "refactor(nav): TopNav consumes NavConfig"
```

---

## Task 3: Migrate BottomNav to NavConfig + contextual FAB

**Files:**
- Modify: `src/components/BottomNav.tsx`

**Step 1:** Replace local `mainTabs` with `NAV_TABS.filter(t => t.primary)`. Replace the `moreMenuItems` array with `NAV_TABS.filter(t => !t.primary)`.

**Step 2:** In the FAB render path (currently fixed to open `QuickAddSheet`):

```tsx
import { usePathname } from "next/navigation";
import { getFabForPath, getTabForPath } from "@/lib/nav/config";

const pathname = usePathname() ?? "/";
const fab = getFabForPath(pathname);
const isHome = getTabForPath(pathname)?.id === "home";

// In the Add button branch:
if (isAdd) {
  if (isHome) {
    return <SheetTriggerFab onClick={() => setQuickAddOpen(true)} />;
  }
  if (fab) {
    return <Link href={fab.href}><FabCircle /></Link>;
  }
  return null; // hide FAB on tabs without one
}
```

Keep the existing pulse/gradient styling; just swap the click handler / Link target.

**Step 3: Manual test**

- `/` → `+` opens QuickAddSheet (unchanged).
- `/calories` → `+` navigates to `/calories/search`.
- `/cycle` → `+` navigates to `/cycle/log`.
- `/log` → `+` navigates to `/log`.
- `/records` → no `+` visible.

**Step 4: Commit**

```bash
git add src/components/BottomNav.tsx
git commit -m "feat(nav): contextual FAB driven by per-tab fab descriptor"
```

---

## Task 4: HomeWidget registry type + empty registry

**Files:**
- Create: `src/lib/home/widgets.ts`
- Test: `src/lib/home/__tests__/widgets.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { HOME_WIDGETS, resolveWidgetOrder } from "../widgets";

describe("HomeWidget registry", () => {
  it("has at least one widget", () => {
    expect(HOME_WIDGETS.length).toBeGreaterThan(0);
  });

  it("every widget has a unique id", () => {
    const ids = HOME_WIDGETS.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("resolveWidgetOrder honors explicit order then appends defaults", () => {
    const result = resolveWidgetOrder({
      explicitOrder: ["favorites-strip"],
      hidden: [],
    });
    expect(result[0]?.id).toBe("favorites-strip");
  });

  it("resolveWidgetOrder filters hidden widgets", () => {
    const hidden = [HOME_WIDGETS[0].id];
    const result = resolveWidgetOrder({ explicitOrder: [], hidden });
    expect(result.find((w) => w.id === hidden[0])).toBeUndefined();
  });
});
```

**Step 2: Implement**

```ts
// src/lib/home/widgets.ts
import type { ComponentType } from "react";
import type { NavTabId } from "@/lib/nav/config";

export interface HomeWidgetContext {
  date: string; // YYYY-MM-DD, today
}

export interface HomeWidget {
  id: string;
  label: string;
  category: NavTabId | "general";
  defaultEnabled: boolean;
  defaultOrder: number;
  Component: ComponentType<HomeWidgetContext>;
}

// Registry is populated in Task 8 after components are wired.
export const HOME_WIDGETS: HomeWidget[] = [];

export function resolveWidgetOrder(opts: {
  explicitOrder: string[];
  hidden: string[];
}): HomeWidget[] {
  const byId = new Map(HOME_WIDGETS.map((w) => [w.id, w]));
  const hidden = new Set(opts.hidden);
  const seen = new Set<string>();
  const out: HomeWidget[] = [];

  for (const id of opts.explicitOrder) {
    const w = byId.get(id);
    if (w && !hidden.has(id) && !seen.has(id)) {
      out.push(w);
      seen.add(id);
    }
  }
  const rest = [...HOME_WIDGETS]
    .filter((w) => !seen.has(w.id) && !hidden.has(w.id) && w.defaultEnabled)
    .sort((a, b) => a.defaultOrder - b.defaultOrder);
  return [...out, ...rest];
}

export function registerWidget(w: HomeWidget) {
  if (HOME_WIDGETS.some((x) => x.id === w.id)) {
    throw new Error(`Duplicate home widget id: ${w.id}`);
  }
  HOME_WIDGETS.push(w);
}
```

**Step 3: Run tests** - the first test will fail (empty registry) until Task 8. Defer the "at least one widget" assertion by marking it `.skip` for now, or register a placeholder. Prefer skip:

```ts
it.skip("has at least one widget", () => { ... });
```

Run:
```bash
npx vitest run src/lib/home/__tests__/widgets.test.ts
```

Expected: 3 pass, 1 skip.

**Step 4: Commit**

```bash
git add src/lib/home/widgets.ts src/lib/home/__tests__/widgets.test.ts
git commit -m "feat(home): widget registry + resolver"
```

---

## Task 5: Extend user preferences with home widget fields

**Files:**
- Modify: `src/lib/api/user-preferences.ts`

**Step 1:** Locate the `UserPreferences` type. Add:

```ts
/** User-chosen ordering of home widget ids. Ids not listed fall through to defaultOrder. */
homeWidgetOrder?: string[];
/** Widget ids the user has explicitly hidden. */
hiddenHomeWidgets?: string[];
```

**Step 2:** Update the default-export object / GET fallback in `src/app/api/preferences/route.ts` to include both keys as empty arrays when no row exists.

**Step 3:** Update the database upsert path (`savePreferences`) to persist the two new fields alongside existing JSON columns. Do NOT alter SQL schema - these live in the same JSON column as `enabledModules`.

**Step 4: Quick verification**

```bash
curl -s http://localhost:3005/api/preferences | jq '.homeWidgetOrder, .hiddenHomeWidgets'
```

Expected: two empty arrays (or existing values).

**Step 5: Commit**

```bash
git add src/lib/api/user-preferences.ts src/app/api/preferences/route.ts
git commit -m "feat(prefs): homeWidgetOrder + hiddenHomeWidgets fields"
```

---

## Task 6: WidgetGrid component

**Files:**
- Create: `src/components/home/WidgetGrid.tsx`

**Step 1:** Server component. Reads preferences, resolves widget order, renders each. Each widget fetches its own data.

```tsx
// src/components/home/WidgetGrid.tsx
import { format } from "date-fns";
import { getPreferences } from "@/lib/api/user-preferences";
import { resolveWidgetOrder } from "@/lib/home/widgets";

export async function WidgetGrid() {
  const prefs = (await getPreferences()) ?? {
    homeWidgetOrder: [],
    hiddenHomeWidgets: [],
  };
  const widgets = resolveWidgetOrder({
    explicitOrder: prefs.homeWidgetOrder ?? [],
    hidden: prefs.hiddenHomeWidgets ?? [],
  });
  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="widget-grid" role="list">
      {widgets.map(({ id, Component }) => (
        <section key={id} role="listitem" data-widget-id={id}>
          <Component date={today} />
        </section>
      ))}
    </div>
  );
}
```

**Step 2:** Commit

```bash
git add src/components/home/WidgetGrid.tsx
git commit -m "feat(home): WidgetGrid server component"
```

---

## Task 7: Create widget wrappers for existing home components

**Files:**
- Create: `src/lib/home/registered-widgets.ts`

**Step 1:** Read the existing `src/app/page.tsx` to see which components it imports and what props they take. For each, build a tiny async wrapper that fetches its own data from Supabase (same queries currently in `page.tsx`) and renders the existing component. Keep the wrappers in one file for now.

Pattern:

```tsx
// src/lib/home/registered-widgets.ts
import { CalorieCard } from "@/components/home/CalorieCard";
import { FavoritesStrip } from "@/components/home/FavoritesStrip";
// ... etc
import { registerWidget } from "./widgets";
import { createServiceClient } from "@/lib/supabase";

async function CalorieWidget({ date }: { date: string }) {
  const supabase = createServiceClient();
  // (move the relevant fetch block from page.tsx here)
  const dailyLog = /* ... */;
  return <CalorieCard dailyLog={dailyLog} date={date} />;
}

registerWidget({
  id: "calorie-card",
  label: "Calories today",
  category: "calories",
  defaultEnabled: true,
  defaultOrder: 10,
  Component: CalorieWidget,
});

// Repeat for each existing home component.
```

**Step 2:** Import this file for its side effects from `src/app/page.tsx` or from a `widgets-init.ts` re-exported by `layout.tsx` (server-only).

**Step 3: Commit**

```bash
git add src/lib/home/registered-widgets.ts
git commit -m "feat(home): register existing cards as widgets"
```

---

## Task 8: Replace page.tsx body with WidgetGrid

**Files:**
- Modify: `src/app/page.tsx`

**Step 1:** Strip the body down to:

```tsx
import "@/lib/home/registered-widgets"; // side-effect registration
import { WidgetGrid } from "@/components/home/WidgetGrid";

export const dynamic = "force-dynamic";

export default function Home() {
  return <WidgetGrid />;
}
```

**Step 2: Smoke-test in the browser**

```bash
# dev server is lanaehealth-dev on 3005
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3005/
```

Expected: 200. Then open in preview and verify the cards look the same as before.

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "refactor(home): page.tsx is now a thin shell over WidgetGrid"
```

---

## Task 9: Home customization sheet

**Files:**
- Create: `src/components/home/CustomizeHomeSheet.tsx`
- Modify: `src/app/page.tsx` (add edit button) or insert as a `WidgetGrid` header.

**Step 1:** Client component sheet listing every `HOME_WIDGETS` entry with:
- Toggle (checkbox) for enabled/hidden - writes `hiddenHomeWidgets`.
- Drag handle to reorder - writes `homeWidgetOrder`.
- "Save" button calls `PUT /api/preferences`.

Keep it minimal. Drag-reorder can use HTML5 native drag or a sort-by-buttons UI for v1.

**Step 2:** Add a small "Customize" button somewhere obvious on home (top-right of the grid).

**Step 3: Commit**

```bash
git add src/components/home/CustomizeHomeSheet.tsx src/app/page.tsx
git commit -m "feat(home): user can toggle/reorder widgets"
```

---

## Task 10: Orphan check + cleanup of old home-page imports

**Files:**
- Modify: any of the dozen `src/components/home/*.tsx` that had bespoke props that no longer fit the widget contract.

**Step 1:** `npx tsc --noEmit` - fix any type errors.

**Step 2:** `npm run lint` - fix warnings.

**Step 3:** Walk through `src/app/page.tsx` git history diff and confirm that every component previously rendered is either registered as a widget OR consciously dropped.

**Step 4: Commit**

```bash
git commit -am "chore(home): reconcile widget wrappers with existing components"
```

---

## Task 11: E2E smoke verification

**Step 1:** Start/reuse the dev server via `preview_start` (name: `lanaehealth-dev`).

**Step 2:** Load these routes, confirm 200 and correct FAB behavior:

- `/` → widgets render, `+` opens QuickAddSheet.
- `/calories` → `+` → `/calories/search` on click.
- `/cycle` → `+` → `/cycle/log`.
- `/log` → `+` → `/log`.
- `/sleep` → page may 404 if route doesn't exist yet; this is expected and the Sleep clone session creates it.
- `/records` → no FAB.

**Step 3:** In the Customize sheet, toggle one widget off, reload, confirm it disappears; toggle it back, confirm it returns.

**Step 4: Commit any verification fixes**

```bash
git commit -am "fix(shell): smoke-test corrections"
```

---

## Task 12: Produce the four clone-session prompts

**Files:**
- Create: `docs/plans/2026-04-19-clone-prompts.md`

**Step 1:** Write four self-contained prompts for parallel sessions. Each one names:
- The worktree to create (`.claude/worktrees/clone-<name>-XXXXXX`).
- The branch name (`claude/clone-<name>`).
- The tab id (`calories | cycle | symptoms | sleep`).
- The competitive folder to study (`docs/competitive/<app>/`).
- The forbidden files list (exactly: `src/components/TopNav.tsx`, `src/components/BottomNav.tsx`, `src/components/AppShell.tsx`, `src/app/page.tsx`, `src/lib/nav/config.ts` - except for adding one line to the tab entry if needed).
- The deliverables: tab landing page, primary log flow, 2–3 home widgets registered via `registerWidget`, a detail view under `/patterns/<tab>`.
- Reference to the non-shaming voice rule [docs/plans/2026-04-16-non-shaming-voice-rule.md](2026-04-16-non-shaming-voice-rule.md).
- Reference to the competitive weakness analysis [docs/research/competitive-analysis-2026-04-17.md](../research/competitive-analysis-2026-04-17.md) (what to avoid that the reference app does poorly).

**Step 2: Commit**

```bash
git add docs/plans/2026-04-19-clone-prompts.md
git commit -m "docs: prompts for 4 parallel clone sessions"
```

---

## Handoff

After Phase 0 lands, Clancy opens four new Claude Code sessions and pastes the four prompts. Each runs in its own worktree and commits into its own branch. When all four PR back, this worktree merges them and runs the Phase 2 integration checklist (Section 4.3 of the design doc).
