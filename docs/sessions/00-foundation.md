# Session 00 — Foundation (prerequisite for all others)

> **Copy this entire file as the opening message of a fresh Claude Code session in the foundation worktree.**

---

You are building **Phase 0: Foundation** of the LanaeHealth v2 mobile UI rebuild. This session is the **hard prerequisite** for the 5 parallel section sessions that follow. Nothing else can start until this lands.

Your output:
1. A pre-flight refactor of 3 components that write to Supabase directly
2. A complete design system extracted from the reference apps (tokens, primitives, mobile shell)
3. Stubbed `/v2/*` route placeholders so parallel sessions don't collide on layout files
4. A `docs/v2-design-system.md` documenting tokens, primitives, naming conventions, and the locked-file rule

After this lands and is merged to `main`, the 5 parallel build sessions can fan out.

## Worktree setup (run this in your terminal first)

```bash
cd /Users/clancybond/lanaehealth/.claude/worktrees/sweet-rosalind-cea925/
scripts/v2-worktree-setup.sh foundation
cd ../v2-foundation
claude
```

Then paste this prompt as your first message.

## Read first (in order)

1. `CLAUDE.md` — project rules, especially the no-em-dash rule and Warm Modern aesthetic
2. `docs/sessions/README.md` — the design philosophy ("best of three"), coordination rules, locked-file rule
3. `docs/reference/README.md` — how the reference assets are organized
4. `docs/reference/oura/frames/full-tour/` — **255 Oura frames** — your PRIMARY visual chrome reference (palette, type, ring metaphors, white space, dark mode)
5. `docs/reference/natural-cycles/frames/full-tour/` — **319 NC frames** — your VOICE reference (explanatory copy patterns) and a SECONDARY visual reference (where NC's softer palette suits explanatory surfaces)
6. `docs/reference/mynetdiary/frames/full-tour/` — **424 MFN frames** — for list-density and food-tracking primitive reference (only)
7. `src/components/log/MoodQuickRow.tsx`, `src/components/settings/MedicationReminders.tsx`, `src/components/log/ClinicalScaleCard.tsx` — the 3 components that need pre-flight refactor
8. `src/lib/supabase.ts`, `src/lib/types.ts` — to understand the data layer you must not touch

## Best-of-three design philosophy

| Layer | Source | Applies to |
|-------|--------|-----------|
| Visual language ("vibes") | **Oura** | Shell, palette, ring metaphors, white space, premium feel |
| Clarity / pedagogy / voice | **Natural Cycles** | All copy: labels, subtext, onboarding, error states |
| Per-section interaction patterns | Section-specific | The actual section surfaces (out of scope for this session) |

This session is responsible for the **visual chrome** (Oura) and the **voice/pedagogy patterns** (NC). Per-section UX patterns get applied by the 5 parallel sessions later.

## Scope: deliverables

### 1. Pre-flight refactor (½ day)

Three components currently write to Supabase directly. Move them behind API routes for total UI/data separation:

- **`src/components/log/MoodQuickRow.tsx`** → create `POST /api/mood/quick-log` route, refactor component to call it
- **`src/components/settings/MedicationReminders.tsx`** → create `POST /api/medications/reminders` route (or extend an existing one)
- **`src/components/log/ClinicalScaleCard.tsx`** → create `POST /api/log/clinical-scale` route

Verify each by smoke-testing the legacy page that uses the component — no behavior change, just call site swap.

### 2. Design tokens (`src/v2/theme/tokens.css`)

**Hard rule:** every value comes from the reference frames. No invention.

Extract from the Oura frames (primary chrome):
- **Colors:** color-pick the palette. Capture: `--bg-primary` (Oura's deep dark), `--bg-secondary`, `--bg-card`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent-primary` (Oura's blue/cyan), `--accent-success`, `--accent-warning`, `--accent-danger`, `--ring-readiness`, `--ring-sleep`, `--ring-activity`, `--border`, `--border-subtle`
- **Typography:** observe Oura's type scale. Define `--font-display`, `--font-body`, `--font-mono`. Sizes: `--text-xs` through `--text-3xl` matching Oura's actual rendered sizes.
- **Spacing:** measure Oura's gaps and paddings. Define `--space-1` through `--space-8` on a consistent scale.
- **Radii:** Oura uses generous radii on cards. Define `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-full`.
- **Shadows:** subtle elevation. Define `--shadow-sm`, `--shadow-md`, `--shadow-lg`.
- **Motion:** `--duration-fast`, `--duration-medium`, `--duration-slow`, `--ease-standard`, `--ease-emphasized`. Match Oura's animation timings.
- **Safe-area insets:** `env(safe-area-inset-*)` mappings.

For surfaces where NC's softer palette suits the content (educational modals, explanatory cards), define a parallel `--surface-explanatory-*` set extracted from NC's cream/blush frames.

Respect CLAUDE.md's Warm Modern aesthetic: cream/blush/sage palette is the secondary palette for explanatory surfaces; Oura's premium dark/cool palette is the primary chrome.

### 3. Component primitives (`src/v2/components/primitives/`)

Each one mirrors the equivalent reference primitive. Build:

- **`Button`** — primary, secondary, tertiary, destructive variants. Match Oura's filled-pill style and NC's outlined-pill style. Min height 44pt.
- **`Card`** — elevation, padding, radius from Oura's metric tile spacing. Variant: `explanatory` (uses NC palette).
- **`ListRow`** — leading icon + label + subtext + trailing chevron/value. Density matches MFN's food-list rows.
- **`MetricRing`** — Oura's readiness ring proportions. Props: value (0-100), label, color, size (sm/md/lg).
- **`MetricTile`** — small metric chip for the home screen tile strip. Match Oura's home tile.
- **`Sheet`** — iOS standard bottom sheet (used by all three reference apps).
- **`Stepper`** — increment/decrement for numeric inputs.
- **`EmptyState`** — illustration slot + headline + subtext + CTA. Voice follows NC.
- **`Skeleton`** — loading placeholder shapes.
- **`Banner`** — for red flags / important notices (will be needed by Doctor session).
- **`Toggle`** — iOS-style switch.
- **`SegmentedControl`** — for tab-like switchers (used by NC's calendar view).

Each primitive ships with:
- TypeScript props interface
- Tailwind / CSS-vars styling using tokens from `tokens.css`
- A storybook-style demo entry on `/v2/_demo` (single page showing every primitive in every state)

### 4. Mobile shell (`src/v2/components/shell/`)

- **`MobileShell`** — root layout. Wraps with theme provider, viewport meta, status bar styling, safe-area handling.
- **`TopAppBar`** — title, optional back button, optional trailing action. Variants: standard, large (Oura-style large header).
- **`BottomTabBar`** — 5 tabs, mirrors Oura/NC pattern. Tab items: Home, Cycle, Food, Log, More.
- **`FAB`** — primary floating action button. Position bottom-right by default, top-left variant for desktop (existing pattern in legacy `QuickLogFab`).

### 5. Route stubs (`src/app/v2/`)

Stub out every route the 5 parallel sessions will own as empty pages returning a placeholder. This prevents collisions on `src/app/v2/layout.tsx` later.

Routes to stub (one `page.tsx` per route, all returning `<div>v2 stub: /v2/...</div>`):

- `/v2` (home)
- `/v2/today`
- `/v2/log`
- `/v2/sleep`
- `/v2/timeline`
- `/v2/patterns`, `/v2/patterns/calories`, `/v2/patterns/cycle`
- `/v2/import`, `/v2/import/myah`
- `/v2/cycle`, `/v2/cycle/log`, `/v2/cycle/history`, `/v2/cycle/predict`
- `/v2/calories`, `/v2/calories/food`, `/v2/calories/food/[fdcId]`, `/v2/calories/search`, `/v2/calories/photo`, `/v2/calories/plan`, `/v2/calories/analysis`, `/v2/calories/custom-foods/new`, `/v2/calories/recipes/new`, `/v2/calories/meal-delete`, `/v2/calories/health/weight`, `/v2/calories/health/blood-pressure`, `/v2/calories/health/heart-rate`
- `/v2/doctor`, `/v2/doctor/care-card`, `/v2/doctor/cycle-report`, `/v2/doctor/post-visit`
- `/v2/records`, `/v2/labs`, `/v2/imaging`
- `/v2/topics/orthostatic`, `/v2/topics/orthostatic/new`, `/v2/topics/cycle`, `/v2/topics/cycle/hormones`, `/v2/topics/nutrition`
- `/v2/settings`

Plus `src/app/v2/layout.tsx` which wraps everything in `MobileShell`.

### 6. Design system documentation (`docs/v2-design-system.md`)

Write a comprehensive document covering:

- Best-of-three philosophy (copy from `docs/sessions/README.md`)
- Token reference (every token, its value, its source frame)
- Primitive reference (every primitive, props, usage example, variant table)
- Naming conventions (file names, component names, prop names)
- Locked-file rule (`src/v2/theme/*` and `src/v2/components/primitives/*` are foundation-owned, parallel sessions cannot modify)
- FOUNDATION-REQUEST process (how parallel sessions request a missing primitive)
- Voice & pedagogy guide (extracted from NC frames — sample copy patterns, "what this means" subtext requirement, error message tone)

### 7. Per-app derived analysis (one of each per app)

Extract from frames and write:

- `docs/reference/oura/colors.md` — palette w/ hex codes (color-picked from frames)
- `docs/reference/oura/typography.md` — observed type scale
- `docs/reference/oura/components.md` — observed primitives + spacing notes
- `docs/reference/oura/flows.md` — navigation patterns observed
- Same 4 files for `natural-cycles/` and `mynetdiary/`

These become permanent reference docs the parallel sessions will consult.

## Acceptance criteria

1. **Demo page works:** `/v2/_demo` renders correctly on iOS Safari at 375pt, 390pt, 428pt — every primitive visible in every state.
2. **Visual parity check:** side-by-side screenshot of each primitive vs its source reference frame — visual match.
3. **All route stubs render:** every stubbed `/v2/*` route returns a placeholder, none 404.
4. **Pre-flight refactor verified:** the 3 refactored components work identically to before in their existing legacy pages.
5. **`docs/v2-design-system.md` is complete enough that a parallel session can read it and start building.**
6. **No engine touch:** no edits to `src/lib/*` (except creating new helpers under `src/lib/api/*` if absolutely needed for the 3 refactored routes), no migrations.

## Locked files (DO NOT EDIT)

- `src/lib/context/*`, `src/lib/cycle/*`, `src/lib/calories/*`, `src/lib/doctor/*`, `src/lib/ai/*` — engine domain logic
- `src/app/api/**` (except adding the 3 new routes for the pre-flight refactor)
- `src/lib/supabase.ts`, `src/lib/types.ts`
- Supabase migrations under `src/lib/migrations/`
- Anything outside `src/v2/`, `src/app/v2/`, `docs/v2-design-system.md`, `docs/reference/*/{colors,typography,components,flows}.md`

## Submission

- PR title: `feat(v2): Phase 0 — foundation (tokens, primitives, shell, route stubs)`
- PR description must include:
  - Screenshots of `/v2/_demo` showing every primitive
  - Side-by-side primitive-vs-source-frame screenshots for at least: Button, Card, MetricRing, MetricTile, ListRow
  - Verification that the 3 refactored components still work
  - Link to `docs/v2-design-system.md`
- After merge, the 5 parallel sessions are unblocked.

## Why this session matters

Every shortcut you take here costs the next 5 sessions. If your tokens are inconsistent, every section will inherit the inconsistency. If your primitives don't match the references, every section will look off. **The reference IS the spec — if you find yourself inventing instead of extracting, stop and re-check the frames.**
