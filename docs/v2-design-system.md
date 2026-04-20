# LanaeHealth v2 design system

Single source of truth for the v2 mobile UI. The reference IS the spec: every token, every primitive shape, every voice pattern traces to a frame under `docs/reference/`. If you find yourself inventing, stop and re-check the frames.

## 1. Philosophy

The v2 UI is "best of three": Oura's visual chrome, Natural Cycles' voice, MyNetDiary's list density. See `docs/sessions/README.md` for the full layering rules.

Primary chrome is **dark** (Oura). Explanatory surfaces (educational modals, onboarding, printable doctor summaries) flip to the **cream/sage NC palette** defined in CLAUDE.md. Both live in `src/v2/theme/tokens.css` under `--v2-*` and `--v2-surface-explanatory-*`.

## 2. Locked files

Editable only via FOUNDATION-REQUEST (see `docs/sessions/README.md`):

- `src/v2/theme/tokens.css`
- `src/v2/components/primitives/*`
- `src/v2/components/shell/*`
- `src/app/v2/layout.tsx`

Not editable by any v2 session:

- `src/lib/context/*`, `src/lib/cycle/*`, `src/lib/calories/*`, `src/lib/doctor/*`, `src/lib/ai/*`
- `src/lib/supabase.ts`, `src/lib/types.ts`
- `src/lib/migrations/*`
- `src/app/api/**` (except additive routes owned by the editing session)
- Anything under `src/components/**` (legacy)

## 3. Tokens

All tokens are CSS custom properties prefixed `--v2-`. Apply by adding the `v2` class to a container (usually handled by `src/app/v2/layout.tsx`).

### 3.1 Color : primary chrome (Oura-derived)

| Token | Value | Source frame | Role |
|---|---|---|---|
| `--v2-bg-primary` | `#0A0A0B` | 0001, 0050, 0150 | Status bar area, page base |
| `--v2-bg-surface` | `#111114` | 0030, 0100 | Content surface with a tiny lift |
| `--v2-bg-card` | `#17171B` | 0050, 0150 | Card surface |
| `--v2-bg-elevated` | `#1F1F25` | 0150 (sheet) | Sheet / modal surface |
| `--v2-text-primary` | `#F2F2F4` | all | Body, headings |
| `--v2-text-secondary` | `#B0B3BD` | 0030, 0100 | Labels, subtext |
| `--v2-text-muted` | `#7E8088` | 0150 | Captions, disabled |
| `--v2-accent-primary` | `#4DB8A8` | 0150 (readiness bars) | CTAs, teal accent |
| `--v2-accent-highlight` | `#E5C952` | 0150 (single bar) | Emphasized data |
| `--v2-accent-warning` | `#D9775C` | 0050, 0150 ("Pay attention") | Warning state |
| `--v2-accent-orange` | `#F0955A` | 0030 (tab underline) | Active tab affordance |
| `--v2-ring-readiness` | `#4DB8A8` | 0001 | Readiness ring |
| `--v2-ring-sleep` | `#9B7FE0` | Oura standard | Sleep ring |
| `--v2-ring-activity` | `#5DADE6` | 0050 (bar chart highs) | Activity ring |
| `--v2-border` | `rgba(255,255,255,0.10)` | 0150 (row dividers) | Standard border |
| `--v2-border-subtle` | `rgba(255,255,255,0.06)` | 0050 | Faintest divider |

### 3.2 Color : explanatory surface (NC-derived)

| Token | Value | Source frame | Role |
|---|---|---|---|
| `--v2-surface-explanatory-bg` | `#FAF5ED` | NC 0080, 0160 | Cream page base |
| `--v2-surface-explanatory-card` | `#FFFFFF` | NC 0080 | White card |
| `--v2-surface-explanatory-text` | `#2B2B2B` | NC 0080 | Body on cream |
| `--v2-surface-explanatory-accent` | `#E84570` | NC 0080 (menstrual ring) | Pink accent |
| `--v2-surface-explanatory-accent-alt` | `#5DBC82` | NC 0160 (fertile days) | Green accent |
| `--v2-surface-explanatory-cta` | `#5B2852` | NC 0160 (FAB) | Deep plum CTA |

### 3.3 Typography

Scale matches Oura's observed hierarchy. Tabular figures on by default (`font-variant-numeric: tabular-nums`) for the dashboard feel.

| Token | Value | Use |
|---|---|---|
| `--v2-text-xs` | 11px | Captions, micro-labels |
| `--v2-text-sm` | 13px | Secondary labels, metadata |
| `--v2-text-base` | 15px | Body |
| `--v2-text-lg` | 17px | Card titles, standard TopAppBar |
| `--v2-text-xl` | 22px | Section headers |
| `--v2-text-2xl` | 28px | Major headlines |
| `--v2-text-3xl` | 34px | Large TopAppBar, hero metrics |

### 3.4 Spacing, radii, shadows, motion

4pt spacing grid, four radii (`sm/md/lg/xl/full`), three shadow levels, motion tokens with iOS `cubic-bezier(0.32, 0.72, 0, 1)`. See `src/v2/theme/tokens.css` for the full list and values.

## 4. Primitives

Implementation at `src/v2/components/primitives/`. Live examples at `/v2/demo`.

| Primitive | Props (summary) | Reference |
|---|---|---|
| `Button` | `variant: primary\|secondary\|tertiary\|destructive`, `size: sm\|md\|lg`, `fullWidth`, `leading`, `trailing` | Oura pill CTA (frame_0001 "Learn more"), NC outlined (frame_0080 button chips) |
| `Card` | `variant: default\|explanatory\|elevated`, `padding: none\|sm\|md\|lg` | Oura card (frame_0030, 0050), NC cream card (frame_0080) |
| `ListRow` | `leading`, `label`, `subtext`, `trailing`, `chevron`, `divider`, `intent: default\|warning\|success`, `onClick` | Oura Contributors (frame_0050, 0150) |
| `MetricRing` | `value: 0-100`, `label`, `color`, `size: sm\|md\|lg`, `displayValue` | Oura readiness ring (frame_0001) |
| `MetricTile` | `icon`, `value`, `label`, `color`, `onClick` | Oura home tile strip (frame_0001) |
| `Sheet` | `open`, `onClose`, `title`, `snapPoints`, `explanatory` | iOS standard; NC explainers in cream variant |
| `Stepper` | `value`, `defaultValue`, `min`, `max`, `step`, `label`, `unit`, `onChange` | Generic numeric input |
| `EmptyState` | `illustration`, `headline`, `subtext`, `cta` | NC voice throughout |
| `Skeleton` | `shape: text\|circle\|rect`, `width`, `height` | Placeholder while loading |
| `Banner` | `intent: info\|warning\|danger\|success`, `title`, `body`, `trailing`, `onDismiss` | Oura "Pay attention" surface (frame_0050, 0150) |
| `Toggle` | `checked`, `defaultChecked`, `onChange`, `label`, `disabled` | iOS switch |
| `SegmentedControl` | `segments`, `value`, `defaultValue`, `onChange`, `fullWidth` | NC Today/Calendar tabs, Oura Yesterday/Today |

## 5. Shell

Implementation at `src/v2/components/shell/`.

- `MobileShell` : root wrapper; applies `.v2` class, safe-area, scroll container.
- `TopAppBar` : variants `standard` (56pt) and `large` (112pt, Oura Readiness style).
- `BottomTabBar` : five slots: Home / Cycle / [center FAB] / Food / More. Active affordance is a thin orange underline plus primary-color label.
- `FAB` : variants `floating` (bottom-right mobile), `tab-center` (inside BottomTabBar), `desktop` (top-left, mirrors legacy QuickLogFab for > 900pt).

## 6. Voice & pedagogy

Every new user-facing string passes the NC voice check:

1. **Short.** Sentences are one idea wide. Explanatory copy caps at three short sentences.
2. **Kind.** "Rough day" beats "Low mood." "Paused" beats "Disabled." Never blame the user.
3. **Explanatory.** Empty states, warnings, and onboarding always tell the user what happened and what to try next, not just "No data" or "Error."
4. **No em-dashes anywhere.** (CLAUDE.md rule, applies to code, copy, docstrings, commits, PR titles.)

See `docs/reference/natural-cycles/flows.md` for copy patterns extracted from NC frames.

## 7. Naming conventions

- CSS tokens: `--v2-<category>-<role>[-<variant>]`, e.g. `--v2-bg-card`, `--v2-accent-warning`, `--v2-ring-readiness`.
- Components: `PascalCase`, default export. One component per file.
- Files under `src/v2/components/<primitives|shell>/` mirror component name.
- Demo sections on `/v2/demo` are titled as the primitive name and cite the source frame in uppercase, e.g. `FRAME_0150.PNG`.

## 8. Provenance & updates

Every token value in § 3 references the reference frame that justified it. If a section session finds a value that no longer matches what a frame shows (because a better frame was added), they file a FOUNDATION-REQUEST to update the token in place, not a local override.

## 9. Known gaps (Phase 0 shipped with these)

- `Sheet` drag handle is non-interactive (snap points are declarative only).
- Icons on tab bar and demo page are glyphs; Phase 1 will replace with a curated icon set.
- No dark/light toggle : chrome is dark-only; explanatory surfaces invert per-component.
- Visual parity is eyeball-matched in Phase 0; pixel-perfect iteration happens in the section sessions that consume the primitive most heavily.
