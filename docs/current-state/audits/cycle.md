# Cycle section audit (session 2026-04-29 / branch claude/jolly-mcnulty-b1a305)

This file is the deliverable for the cycle-section session per
`docs/current-state/sessions/cycle.md`. It covers the four asks in the brief:

1. Interactivity audit (every interactive element + whether the recording
   exercises it).
2. Viewport bug check on Cycle (per `docs/current-state/known-issues.md`
   issues #1 and #2).
3. Visual quality deltas vs the Natural Cycles north-star and the v2 token
   set, with in-scope fixes implemented and cross-cutting items filed for
   foundation discussion.
4. E2E test for whatever flow changed.

The closing section ("Session summary") records what was fixed, what was
punted, and what was learned.

## 1. Interactivity audit

The 2026-04-29 recording shows state changes only, never which element
produced a tap. The "exercised in recording?" column reflects what can be
inferred from the navigation transitions in `INDEX.md` (Cycle frames 0011 to
0019, plus 0045 and 0046). Anything I could not infer with confidence is
marked `unclear`.

### `/v2/cycle` (landing)

| Element | Location | Exercised? |
|---|---|---|
| Bell / messages link (with unread badge) | `src/app/v2/cycle/page.tsx:168` (Link to `/v2/cycle/messages`) | unclear |
| History text link | `src/app/v2/cycle/page.tsx:211` (Link to `/v2/cycle/history`) | unclear |
| FAB "Log cycle entry" | `src/app/v2/cycle/page.tsx:233` (Link to `/v2/cycle/log`) | unclear |
| NCPhaseInsightCard "Full graph" pill | `src/app/v2/cycle/page.tsx:256` (Link `graphHref="/v2/cycle/insights"`) | yes (recording reaches insights) |
| NCPhaseCard | `src/app/v2/cycle/page.tsx:271` (presentational) | n/a |
| WeekdayStrip cells | `src/app/v2/cycle/page.tsx:296` | unclear |
| NCSymptomChips (chips route to `/v2/cycle/log?symptom=<slug>`) | `src/app/v2/cycle/page.tsx:302` | unclear |
| NCStatsCard rows (cycle / period / BBT baseline / luteal) | `src/app/v2/cycle/page.tsx:311-385` (presentational) | n/a |
| PeriodTodaySheetLauncher | `src/app/v2/cycle/page.tsx:391` | unclear |
| PeriodCountdownCard (button-as-card opens explainer modal) | `src/app/v2/cycle/page.tsx:426` -> `_components/PeriodCountdownCard.tsx:66` | unclear |
| FertilityAwarenessCard | `src/app/v2/cycle/page.tsx:427` -> `_components/FertilityAwarenessCard.tsx` | unclear |
| BbtChartPanel header (button opens CoverLineExplainer) | `src/app/v2/cycle/page.tsx:443` -> `_components/BbtChartPanel.tsx:42` | unclear |
| BbtTile | `src/app/v2/cycle/page.tsx:451` | unclear |
| Phase insight tinted card | `src/app/v2/cycle/page.tsx:459-505` (presentational) | n/a |
| "See cycle insights" list-row link | `src/app/v2/cycle/page.tsx:511` (Link to `/v2/cycle/insights`) | yes (recording reaches insights) |
| CorrectionsPanel field-level edit affordances | `src/app/v2/cycle/page.tsx:537` -> `src/v2/components/CorrectionsPanel.tsx` | no |
| Awareness-not-contraception Banner | `src/app/v2/cycle/page.tsx:583` (presentational) | n/a |
| StandardTabBar (Home, Cycle, +, Food, More) | `src/app/v2/cycle/page.tsx:231` -> `src/v2/components/shell/StandardTabBar.tsx` | yes (recording navigates between tabs) |
| CycleTourLauncher (auto-start tutorial) | `src/app/v2/cycle/page.tsx:590` | unclear |

### `/v2/cycle/insights`

| Element | Location | Exercised? |
|---|---|---|
| Back chevron + "Cycle" link | `src/app/v2/cycle/insights/page.tsx:263` (Link to `/v2/cycle`) | yes (recording returns from insights) |
| CycleInsightsChart data points (clickable circles open SnapshotCard) | `insights/_components/CycleInsightsChart.tsx:301-333` | unclear (recording shows empty plot) |
| CycleInsightsChart phase legend chips | `insights/_components/CycleInsightsChart.tsx:381-415` (presentational) | n/a |
| SnapshotCard close button | `insights/_components/CycleInsightsChart.tsx:468` | unclear |
| MultiCycleCompare rows | `insights/_components/MultiCycleCompare.tsx:152` (role=row, no onClick) | n/a |
| StatisticsRollup rows | `insights/_components/StatisticsRollup.tsx:215` (presentational) | n/a |
| SymptomRadarCard "Log this symptom" link | `insights/_components/SymptomRadarCard.tsx:147` (Link to `/v2/cycle/log`) | unclear |
| InsightRow cards | `insights/_components/InsightRow.tsx:13` (presentational) | n/a |

### `/v2/cycle/history`

| Element | Location | Exercised? |
|---|---|---|
| Back chevron | `src/app/v2/cycle/history/page.tsx:226` (Link to `/v2/cycle`) | no |
| EmptyState "Log today" CTA | `history/page.tsx:262` (Link to `/v2/cycle/log`) | no |
| CycleHistoryClient (calendar grid + day-detail sheet) | `history/_components/CycleHistoryClient.tsx` | no |
| NCHistoryRail rows (open day detail on tap) | passed via `railGroups`, rendered inside CycleHistoryClient | no |
| CycleHistoryRow per completed cycle | `_components/CycleHistoryRow.tsx` | no |

### `/v2/cycle/log`

| Element | Location | Exercised? |
|---|---|---|
| Back glyph "‹ Cycle" | `src/app/v2/cycle/log/page.tsx:166` (Link to `/v2/cycle`) | no |
| LogDatePicker (date + cycle-day text) | `log/page.tsx:182` -> `log/_components/LogDatePicker.tsx` | no |
| NCPeriodLogHero one-tap flow pills | `log/page.tsx:207` -> `src/v2/components/NCPeriodLogHero.tsx` (locked, consume only) | no |
| "Learn how to track accurately" link | `log/page.tsx:213` (Link to `/v2/learn/tracking-your-period-accurately`) | no |
| PeriodLogFormV2 (full form, many fields) | `log/page.tsx:227` -> `_components/PeriodLogFormV2.tsx` | no |

### `/v2/cycle/messages`

| Element | Location | Exercised? |
|---|---|---|
| Back chevron | `messages/page.tsx:102` (Link to `/v2/cycle`) | no |
| MessagesList items | `messages/_components/MessagesList.tsx` | no |
| EmptyState (no CTA) | `messages/page.tsx:145` | no |

### `/v2/cycle/predict`

| Element | Location | Exercised? |
|---|---|---|
| Back chevron | `src/app/v2/cycle/predict/page.tsx:46` (Link to `/v2/cycle`) | no |
| PeriodCountdownCard (button-as-card) | `predict/page.tsx:94` -> `_components/PeriodCountdownCard.tsx` | no |
| FertilityAwarenessCard | `predict/page.tsx:95` -> `_components/FertilityAwarenessCard.tsx` | no |
| BbtChartPanel header (button opens explainer) | `predict/page.tsx:111` -> `_components/BbtChartPanel.tsx` | no |

### Follow-ups out of the audit

- "Looks tappable but is not" candidates: the small `°` superscript on the
  `Cycle` wordmark, the cycle-day pill inside NCPhaseCard, the InsightRow
  source-citation strip. None of these have `onClick` handlers; they are
  styled but inert. Consistent with NC and Oura conventions, so flagged
  here as "research" rather than "bug".
- "Tappable but no handler" candidates: none found in the cycle scope.
- Tutorial steps (CycleTourLauncher) anchor to `data-tour-step="..."`
  attributes on bell, history-link, today-ring, period-prompt,
  phase-chip, bbt-tile, explainer-chip. These are not interactive
  themselves; they are spotlight targets for the tour overlay.

## 2. Viewport diagnosis

Approach: systematic-debugging Phase 1 (reproduce + gather evidence) before
proposing fixes. I started a worktree-local dev server on port 3006 with
`LANAE_REQUIRE_AUTH=false`, then for each cycle route ran
`document.documentElement.scrollWidth > clientWidth` and enumerated any
element whose `getBoundingClientRect().right > viewport + 0.5px` at both
375pt and 390pt.

**First pass (MCP probe, no Supabase data):** all routes that loaded
showed zero overflow.

| Route | Viewport | docScrollWidth | overflowing elements (excluding skip-to-main-content) |
|---|---|---|---|
| `/v2/cycle` | 390 | 390 | 0 |
| `/v2/cycle` | 375 | 375 | 0 |
| `/v2/cycle/insights` | 390 | 390 | 0 |
| `/v2/cycle/insights` | 375 | 375 | 0 |
| `/v2/cycle/history` | 375 | 375 | 0 |

`/v2/cycle/log`, `/v2/cycle/predict`, and `/v2/cycle/messages` returned the
service-worker offline fallback in the side dev server (those routes call
`createServiceClient()` or `runScopedQuery()` paths that need Supabase auth
context that the side instance lacked at this point).

**This first pass was a false negative for `/v2/cycle/insights`.** Once
the dev server was reconfigured with `.env.local` symlinked and real
Supabase data flowed, the Recharts chart actually mounted and the
follow-up E2E spec caught a 45-pixel horizontal overflow on
mobile-chrome at 375pt. See "Verdict" below for the trace and fix. The
lesson, recorded for future audits, is that a chart-overflow probe must
exercise the chart with real data; an empty-state card cannot leak past
the viewport because it has no SVG content to leak.

**Verdict, partial reproduction with leaf-level cause and fix in scope.** The
brief's hypothesis that `/v2/cycle/insights` (frame_0018) is suspect was
correct, but only when the chart actually mounts. The Playwright MCP probe
I ran first reported zero overflow because the dev server was returning
the cycle `error.tsx` boundary (Supabase auth context unavailable in the
side instance), so the Recharts SVG never rendered. Once
`tests/e2e/v2-cycle-viewport.spec.ts` ran with `.env.local` symlinked and
real data flowing, the chart mounted and surfaced the bug.

**Root cause:** `CycleInsightsChart.tsx:265-275` declared the cover-line
`<ReferenceLine>` with `label.position: 'right'`. Recharts renders
`position: 'right'` *outside* the plot area to the right of the line's
end, with no `ifOverflow` handling. On a 375pt viewport with the chart
container at ~311pt of internal width, the "Cover line 97.8 F" label
extended to a `getBoundingClientRect().right` of ~420, which is 45 pixels past
the viewport edge. The parent `<g>` group reported the same boundary
because its child text dragged its bounds out. mobile-chrome (Pixel 7)
caught this every run; mobile-safari (iPhone 13 Pro) clipped the label
silently.

**Fix (D4, in scope at `insights/_components/CycleInsightsChart.tsx`):**
change `position: 'right'` to `position: 'insideTopRight'`. The label
still appears near the top-right of the line but stays inside the SVG.
The y-axis tick already shows the cover-line value (97.8) so the label
duplicates information; keeping it as a confirmation read is fine, but
not at the cost of horizontal overflow. No `overflow-x: hidden` band-aid;
no breakpoint widening; the fix is at the layout-cause leaf as the brief
required.

**The other realistic candidates checked out clean.** The `MultiCycleCompare`
5-column grid (`32px 1fr 56px 56px 56px`) at 375pt with 16pt page padding
plus Card md-padding both sides leaves ~80pt for the `1fr` "Window"
column. Tight but holding because each row's inner `<div role="cell">` has
`min-width: 0` allowing natural wrapping. The chart's main `width={width}`
sourced from a `ResizeObserver` is also fine; the bug was only in
overlay-style references rendered with positions that escape the plot
area.

**Caveat for known-issues #1 generalization.** This finding does not
contradict the markdown-content hypothesis from known-issues.md; it adds
a second mechanism. The general rule for v2 surfaces stands: any
SVG-overlay element (Recharts `<ReferenceLine>`, `<ReferenceArea>`,
`<Brush>`) that defaults to outside-the-plot rendering is at risk on
narrow viewports. Future Recharts integrations should default label
positions to the `insideX` family unless the chart has reserved
right/left/top/bottom margin to absorb the leak.

## 3. Visual quality deltas

This is the part of the brief that called the app "visually disappointing".
For Cycle specifically, here is what I found by holding the source against
`docs/reference/natural-cycles/` and `src/v2/theme/tokens.css`. The list is
ordered by impact, not by where I happened to look first.

### Implemented in scope (this session)

- **D4. CycleInsightsChart cover-line label leaks past the viewport.**
  See section 2 above for the full trace. The `<ReferenceLine>` label
  used `position: 'right'` (outside the plot area). Switched to
  `position: 'insideTopRight'`. Regression-locked by
  `tests/e2e/v2-cycle-viewport.spec.ts`.

- **D1. Inconsistent back glyph on `/v2/cycle/log`.**
  Every other cycle subroute (`insights`, `history`, `messages`,
  `predict`) uses `<ChevronLeft size={20} aria-hidden />` from `lucide-react`
  for its back link. `log` uses a plain text glyph `‹ Cycle`. The text
  glyph is visually thinner, anti-aliases differently, and breaks the
  uniformity of the section's chrome.
  Fix: switch `log/page.tsx` to the same Lucide icon pattern as the other
  routes.

- **D2. `/v2/cycle/predict` missing `.v2-surface-explanatory` wrapper.**
  Every other cycle route wraps its content `<div>` in
  `className="v2-surface-explanatory"`. `predict` does not. That class is
  the chrome-override hook that maps `--v2-bg-card`, `--v2-text-primary`,
  etc. to the NC light palette inside the wrapped subtree. Without it,
  predict reads as the dark Oura chrome while its siblings read as NC
  cream, producing a chrome flicker on navigation.
  Fix: add `className="v2-surface-explanatory"` to predict's outer div for
  consistency with the rest of the cycle section. (This is a section-level
  consistency fix; the broader question of whether cycle should be cream
  at all is logged below as cross-cutting.)

- **D3. `/v2/cycle/predict` plain-string TopAppBar title.**
  Every other cycle route renders the title as a styled
  `<span style={{ color: 'var(--v2-surface-explanatory-cta, #5B2852)' }}>`
  in NC plum. Predict uses `title="What's coming"` as a plain string, so
  the system default (white text, --v2-text-primary) renders. The chrome
  reads inconsistent across the section.
  Fix: render predict's title as the same styled span pattern.

### Cross-cutting (FOUNDATION-REQUEST candidates)

- **F1. Cycle chrome policy: NC cream vs Oura dark.**
  Commits `86ce254` and `f1bfd40` (Apr 27) deliberately rewrapped the
  cycle section in `.v2-surface-explanatory`, switching its chrome from
  Oura dark to NC cream. CLAUDE.md still says NC cream is "reserved for
  explanatory surfaces (educational modals, onboarding, printable doctor
  summaries)". `docs/current-state/sessions/cycle.md` describes the
  recorded surface as "the dark Oura-derived chrome" with a pink Cycle
  accent. The cycle section as it stands today contradicts both the
  CLAUDE.md rule and the cycle.md description. This is a per-section
  identity question, not a bug. Resolution belongs in the foundation
  layer (either rewrite the rule, or roll back the chrome wrap and use
  inline NC-cream tiles only). Filed as F1, not patched at the section
  level.

- **F2. NC pink badge color shadows tab-bar accent.**
  `src/v2/components/shell/StandardTabBar.tsx` is locked. The bell-badge
  on `/v2/cycle` paints `var(--v2-accent-red, #E84570)` on top of a
  StandardTabBar that may itself be rendering on a cream surface (per F1).
  Pink-on-cream is the right color story; pink-on-dark is fine too. The
  combined story is fine in either chrome but should be verified in
  whichever palette F1 lands on. No section-level patch.

- **F3. Inert "looks tappable" affordances.**
  The Cycle wordmark superscript `°` and the cycle-day pill inside
  NCPhaseCard read as tappable per NC's visual idiom but are inert in
  source. Either add an interaction (open the section's explainer modal)
  or downplay the affordance. Touches both `src/app/v2/cycle/page.tsx`
  (the wordmark) and `src/v2/components/NCPhaseCard.tsx` (locked). Filed
  as F3 for foundation discussion.

### Items considered and rejected

- **R1. Chart legend wrap on narrow viewports.**
  `CycleInsightsChart` legend chips use `flexWrap: wrap`. Verified live at
  375pt, no overflow. No fix needed.
- **R2. Numeric column tightness in MultiCycleCompare at 320pt.**
  CLAUDE.md and the playwright config target 375pt and 390pt; 320pt is
  not a supported width. Not fixed; flagged for future iPhone-SE-1
  support if it becomes a goal.
- **R3. `data-tour-step` attributes "looking tappable".**
  These are spotlight anchors for `CycleTourLauncher`. They are not
  affordances by themselves. Documented in the audit, no fix.

## 4. E2E coverage

The existing cycle suite (`tests/e2e/v2-cycle.spec.ts`,
`v2-cycle-insights.spec.ts`, `v2-cycle-tour.spec.ts`,
`v2-cycle-messages.spec.ts`) covers render, WeekdayStrip, NC symptom
chips, FAB-to-log routing, and tour-step anchoring. This session adds
`tests/e2e/v2-cycle-viewport.spec.ts` covering both deliverables that
need lock-in from this session:

- **Viewport-overflow regression** at 375pt and 390pt on `/v2/cycle`,
  `/v2/cycle/insights`, and `/v2/cycle/history`. Asserts
  `documentElement.scrollWidth <= clientWidth` and zero elements with
  `getBoundingClientRect().right > viewport + 0.5`. Initially failed on
  insights (mobile-chrome) with the cover-line label leak; passes after
  D4. Re-runs in 19 seconds across both browser projects.
- **Chrome consistency** for the `/v2/cycle/log` and `/v2/cycle/predict`
  back-link affordances after D1 / D2 / D3. Asserts the back link has an
  `<svg>` child (the lucide ChevronLeft icon) so a future regression to
  the text-glyph `‹` shape fails the build.

The new viewport spec was run twice against the worktree-local dev
server (port 3006 with `LANAE_REQUIRE_AUTH=false`): once before the D4
fix to confirm the bug was real (insights at 375pt failed on
mobile-chrome with the 45-pixel cover-line label leak), and once after
the fix to confirm green. All 16 tests in the new spec pass in 19.4
seconds across both browser projects.

The broader cycle suite (`v2-cycle.spec.ts`, `v2-cycle-insights.spec.ts`,
`v2-cycle-tour.spec.ts`, `v2-cycle-messages.spec.ts`) was attempted in
the same run and surfaced 32 pre-existing failures unrelated to this
session's edits. Root cause: `v2-cycle-tour.spec.ts` navigates to
`/v2/settings`, which renders `HealthKitSyncCard` whose Server Component
dynamically imports `capacitor-health`. That package is declared in
`package.json` (`^8.1.0`) but is missing from
`/Users/clancybond/lanaehealth/node_modules/`, the workspace root that
Turbopack auto-detected because the main repo and this worktree share a
parent. Once Turbopack hits the unresolved import, every subsequent
route compile lands in a 500 cascade in the same dev server. This is an
environment issue (`npm install` in the workspace root) and falls
outside the cycle session scope. Recorded here so a future session
running the full suite knows the failure category at a glance.

## 5. Session summary

This session closes all four deliverables in the brief: an interactivity
audit, the viewport-bug verdict, a visual quality pass with concrete
fixes, and at least one E2E test for the changed flow. The cross-cutting
chrome-policy contradiction is filed for foundation discussion rather
than patched at the section level.

**Fixed in scope.** One real horizontal-overflow bug plus three
section-level chrome-consistency edits. The overflow bug (D4) is a
Recharts `<ReferenceLine>` label with `position: 'right'` that rendered
its text past the SVG edge on narrow viewports, the brief's exact
hypothesis about frame_0018, found only after the spec drove the chart
through real data. Switching to `position: 'insideTopRight'` keeps the
label visible without leaking; no `overflow-x: hidden` band-aid was
applied. The chrome edits are smaller:
`/v2/cycle/log` now uses the lucide `ChevronLeft` icon for its back link
(D1) instead of the lone-route text glyph `‹ Cycle`.
`/v2/cycle/predict` was the only cycle route missing
`className="v2-surface-explanatory"` on its outer wrapper, so its chrome
flickered light-to-dark on navigation; the wrapper is now in place (D2).
The same route was also rendering its TopAppBar title as a plain string,
so the system default styled it as white instead of the NC plum the rest
of the section uses; it now mirrors the styled-span pattern from the
other five cycle routes (D3). All three are pure consistency fixes
with single correct answers; no new affordances were introduced.

**Punted to foundation.** The biggest finding is not a delta but a
contradiction. Commits `86ce254` and `f1bfd40` (Apr 27) intentionally
rewrapped the entire cycle section in `.v2-surface-explanatory`, switching
its chrome from Oura dark to NC cream. CLAUDE.md still says NC cream is
"reserved for explanatory surfaces (educational modals, onboarding,
printable doctor summaries)", and the brief's own `cycle.md` describes
the recorded surface as "the dark Oura-derived chrome" with a pink
accent. The current source contradicts both. This is a per-section
identity question, not a leaf bug, so I filed it as F1 and did not patch
at the section level. F2 (pink badge color story across whichever chrome
F1 lands on) and F3 (inert-but-tappable-looking superscript and cycle-day
pill) are also flagged for foundation discussion.

**Locked in by tests.** After D4 lands, the cycle section is clean on
both deliverables that needed lock-in. Live evidence at 375pt and 390pt
on `/v2/cycle`, `/v2/cycle/insights`, and `/v2/cycle/history` shows
`documentElement.scrollWidth <= clientWidth` and zero elements crossing
the viewport edge other than the deliberately offscreen
skip-to-main-content marker. The `MultiCycleCompare` 5-column grid (the
other realistic candidate) holds inside its container without help.
`tests/e2e/v2-cycle-viewport.spec.ts` regression-locks the answer at
both widths and both browser projects so a future fixed-pixel chart, a
re-introduced `position: 'right'` ReferenceLine label, or an unbroken-
token import fails CI with a precise pointer to the offending element
rather than re-opening the whole investigation.

**Learned about the surface.** Four notes the brief did not capture.
First: a probe with no data loaded is a *false negative* for chart-overflow
bugs. My initial Playwright MCP probe of `/v2/cycle/insights` showed zero
overflow, but only because Supabase auth context was missing in that
session and the chart never mounted; the same surface failed
`tests/e2e/v2-cycle-viewport.spec.ts` once the spec ran with `.env.local`
symlinked. Future sessions should always drive the route through real
data before claiming "no overflow", or the regression test will catch
what the eyeball test missed. Second: any Recharts overlay element
(`<ReferenceLine>`, `<ReferenceArea>`, `<Brush>`) that defaults to
outside-the-plot rendering is at risk on narrow viewports; default label
positions to the `insideX` family unless the chart has reserved
right/left margin to absorb the leak. Third: the cycle landing contains
three explicit `LEARNING-MODE HOOK` comments in source (G1 today-screen
signal priority, G2 log-flow shape, G3 uncertainty copy) which give a
future session natural seams to vary the surface without rewriting it.
Fourth: the `/v2/cycle/log` and `/v2/cycle/predict` routes hit
`createServiceClient()` and `runScopedQuery()` paths that error when
Supabase auth context is missing, which falls through to the cycle
`error.tsx` boundary. The error fallback is not visible in the recording
but it is the only thing a misconfigured preview deploy will show, so its
visual fidelity also matters; that is worth a follow-up audit on its own.
