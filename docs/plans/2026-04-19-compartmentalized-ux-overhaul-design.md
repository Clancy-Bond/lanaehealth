# Compartmentalized UX Overhaul - Design Document

**Date:** 2026-04-19
**Status:** Design - awaiting approval
**Author:** Claude (Opus 4.7) for Clancy, on behalf of Lanae

## 1. Problem

The current app feels clunky to the primary user. Root causes identified in the audit:

1. **Home page is 24 stacked components.** [src/app/page.tsx:3-23](../../src/app/page.tsx#L3-L23) imports every widget unconditionally. No user-level toggle. The user cannot decide what "Today" means to them.
2. **Two navigation systems disagree.** Desktop [TopNav](../../src/components/TopNav.tsx) has 8 tabs in one taxonomy; mobile [BottomNav](../../src/components/BottomNav.tsx) has 5 tabs + "More" overflow with 8 more in a different taxonomy. Users must learn two mental models. Every nav change has to update both, and they drift.
3. **The global `+` button is context-blind.** [BottomNav.tsx:234-271](../../src/components/BottomNav.tsx#L234-L271) opens the same `QuickAddSheet` on every route. On `/calories` the user expects "add meal"; on `/cycle` "log period"; on `/log` "log symptom". The current sheet is a generic 6-tile grid.
4. **No "compartmentalization".** Each health concern (nutrition, cycle, symptoms, sleep) is a scattering of pages plus home widgets rather than its own self-contained experience.

## 2. Goal

Alignment with [2026-04-15-master-plan-universal-health-platform.md](2026-04-15-master-plan-universal-health-platform.md) Identity 2:

> Best-in-class standalone that replaces the user's calorie tracker, period tracker, symptom logger, and wearable dashboard. Built by studying what users love/hate about the top apps in each category.

Target reference apps (not verbatim copies - independently built UIs that carry the same interaction models):
- **Calories** → MyNetDiary
- **Cycle** → Natural Cycles
- **Symptoms / Pain** → Bearable
- **Sleep** → Oura

Existing competitive research in [docs/competitive/](../competitive/) covers each.

## 3. Approach: Unified Shell + Four Compartmentalized Clones

Three structural changes, then four clone builds. The shell lands first because all four clones plug into it.

### 3.1 Shell: one nav, one contract

**Single `NavConfig` source of truth** at `src/lib/nav/config.ts`. Shape:

```ts
export type NavTabId = "home" | "calories" | "cycle" | "symptoms" | "sleep"
                     | "records" | "doctor" | "patterns";

export interface NavTab {
  id: NavTabId;
  label: string;
  icon: LucideIcon;
  href: string;
  matchPrefixes?: string[];
  /** What the FAB does on this tab. Omit = hide FAB. */
  fab?: { label: string; href: string; icon: LucideIcon };
  /** Visible by default on the primary bar vs. collapsed into "More". */
  primary?: boolean;
}
```

`TopNav` and `BottomNav` both consume this config. Mobile collapses tabs with `primary: false` into an overflow sheet; desktop shows all. Collapsible via a chevron on desktop (icon-only when collapsed) and swipe/tap-away on mobile.

### 3.2 Contextual FAB

The `+` button reads the active tab from `NavConfig` and:
- On tab with `fab` defined → routes to `tab.fab.href` (e.g., `/calories/add`, `/cycle/log`, `/log/quick`, `/sleep/log`).
- On `home` → opens `QuickAddSheet` as today (route-agnostic shortcuts).
- On tabs without `fab` (e.g., `records`) → button hidden.

Implementation: `BottomNav.tsx` reads the FAB descriptor for the current route and renders either a Link or opens the sheet.

### 3.3 Editable Home (widget grid)

Home becomes a grid of registered widgets, each opt-in per user.

**Widget registry** at `src/lib/home/widgets.ts`:

```ts
export interface HomeWidget {
  id: string;                // stable key, e.g. "calorie-card"
  label: string;             // user-facing "Today's calories"
  category: NavTabId;        // which clone-tab owns it
  defaultEnabled: boolean;
  defaultOrder: number;
  Component: ComponentType<{ userId: string; date: string }>;
}
```

**Preferences extension:** reuse `enabledModules` + add `homeWidgetOrder: string[]` and `hiddenHomeWidgets: string[]` to the existing preferences shape in `src/lib/api/user-preferences.ts`. No new table.

**Home page becomes thin:** `src/app/page.tsx` fetches the user's widget preferences, resolves the widget list, and renders each. Each widget owns its own data fetching (parallel by default via React Server Components). This removes the 24-import God-page.

**Edit mode:** a "Customize" button on Home opens a sheet listing every registered widget with an on/off toggle and drag-to-reorder. Changes persist via `PUT /api/preferences`.

### 3.4 Four clone-tabs

Each clone owns:
- its top-level route (`/calories`, `/cycle`, `/log`, `/sleep`)
- a set of sub-routes under that prefix
- its home widgets (registered in the widget registry with `category: <tab-id>`)
- its `NavTab` entry and `fab` descriptor

Clones DO NOT:
- edit `TopNav.tsx` / `BottomNav.tsx` / `AppShell.tsx` directly
- edit each other's routes
- touch `src/app/page.tsx` (only register widgets in `src/lib/home/widgets.ts`)

This is the parallelization contract.

## 4. Execution Plan

### Phase 0 - Shell (Clancy's main session, this one)

Sequenced because every clone depends on these files.

1. Create `src/lib/nav/config.ts`, migrate both navs to read from it.
2. Refactor `BottomNav` FAB to consume `tab.fab`.
3. Create `src/lib/home/widgets.ts` registry + `src/components/home/WidgetGrid.tsx`.
4. Extend `user-preferences.ts` with `homeWidgetOrder` + `hiddenHomeWidgets`.
5. Replace `src/app/page.tsx` body with `<WidgetGrid />`.
6. Register existing home components as widgets (preserves today's experience for users who don't customize).
7. Add `/settings/home` (or an inline sheet) for the edit-mode UI.

Estimated scope: ~10-14 file touches, no new tables, all additive. E2E smoke: home still renders all existing cards with default preferences.

### Phase 1 - Four parallel clone sessions (fan-out)

Each spawned as a separate Claude Code session in its own git worktree. Prompts produced at end of Phase 0 so Lanae / Clancy can paste them into 4 new terminals.

Clone boundaries:
- **Calories:** `/calories/**`, widgets with `category: "calories"`, files under `src/components/calories/` and `src/lib/calories/`.
- **Cycle:** `/cycle/**`, widgets with `category: "cycle"`, files under `src/components/cycle/` and `src/lib/cycle/`.
- **Symptoms:** `/log/**` and `/symptoms/**`, widgets with `category: "symptoms"`, files under `src/components/log/` and `src/components/symptoms/`.
- **Sleep:** `/sleep/**`, widgets with `category: "sleep"`, files under `src/components/sleep/` and `src/lib/sleep/`.

Each session receives:
- link to its folder in `docs/competitive/`
- link to [competitive-analysis-2026-04-17.md](../research/competitive-analysis-2026-04-17.md) (what to *avoid* that the reference app does poorly)
- link to this design doc + the nav/widget contract
- a tight spec of deliverables (minimum: tab landing page + primary log flow + 2-3 home widgets + a `/patterns` detail view)
- explicit "do not edit" list: `TopNav.tsx`, `BottomNav.tsx`, `AppShell.tsx`, `src/app/page.tsx`, `src/lib/nav/config.ts` (except to add own tab)

### Phase 2 - Integration (Clancy's main session)

After all 4 clones land:
1. Review the 4 tab entries in `NavConfig` for consistent labels/icons.
2. Smoke-test home customization sheet with all registered widgets.
3. E2E: load each tab on mobile and desktop, confirm FAB does the right thing.
4. Kill orphaned files from the old home that no clone adopted.

## 5. Out of scope

- New database tables.
- Identity 1 (Universal Data Hub) ingest changes. That continues on its own track.
- Onboarding rewrite. Current `/onboarding` stays.
- Theming overhaul. Current warm-modern palette is the shared aesthetic baseline; polish happens inside each clone.

## 6. Success criteria

- Home page imports ≤ 3 components (WidgetGrid + shell + edit sheet).
- A user can toggle off any home widget and it disappears on next load.
- Pressing `+` on `/calories/food` navigates to add-meal; on `/cycle` to log-period; on `/log` to symptom entry.
- One `NavConfig` array is the only place tabs are defined.
- Four clone tabs each look and feel like the reference app, not like each other.

## 7. Risks

- **Widget data fetching perf.** If every widget fetches independently we lose the parallel-Promise.all of the current page. Mitigation: Server Components can still be concurrent via React 19 streaming; keep individual queries cheap.
- **Clones diverge on aesthetics.** Mitigation: each session references the same tokens in `globals.css` and the "warm modern" design doc; I review before merge.
- **Merge conflicts on `NavConfig`.** Only 4 one-line additions expected, easy to resolve.
