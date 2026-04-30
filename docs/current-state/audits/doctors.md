# /v2/doctor — Doctor Mode interactivity audit

**Audited:** 2026-04-29
**Scope:** `src/app/v2/doctor/page.tsx`, `src/app/v2/doctor/_components/**`
**Viewport profile:** mobile-first (393×852 iPhone Pro target)
**Status:** post horizontal-overflow fix (this branch)

The session brief asked me to verify what the user remembered as frame 0105 ("Hypotheses" / "Next actions" tab-like affordances at the bottom, a "Show this?" link, and a teal chat bubble with a prefilled question). I read every component used by `DoctorClientV2` and could not find any of those four affordances in the current code. The brief's description likely predates the v2 rebuild. What follows is what the surface actually does today, not what the frames implied.

## What the page renders

`DoctorClientV2` produces a single long, scrollable page with no tabs, no accordions, no swipe gestures, and no per-card filtering. The bottom navigation is suppressed by passing `bottom={null}` to `MobileShell` so a doctor reading during a visit cannot accidentally trip nav. Nothing is hidden behind taps.

The vertical order, top to bottom:

1. `TopAppBar` — back chevron, "Doctor Mode" title, **Export PDF** button, **Legacy** link.
2. `SpecialistToggleRow` — sticky section header. Shows the active specialist label (e.g. "PCP / Internal Medicine") with subtitle, plus a `SegmentedControl` toggle for PCP / OB-GYN / Cardiology. Drives `bucketVisible()` filtering across every card below via a `view` prop.
3. Failure banner (conditional) — appears above red flags if any of the ~16 fan-out queries failed, with a Retry button that calls `router.refresh()` inside a `useTransition`.
4. `RedFlagsSection` — distinct first card. The red flag headline gets the only urgent press affordance: each flag has a `Call today` / `Call urgent care` chip.
5. Specialist opening line — `Card` variant `explanatory`, no interaction.
6. `ExecutiveSummaryCard` — vitals + abnormal-lab counts, no interaction.
7. **One-page handoff link** — explanatory card with a single underlined link to `/v2/doctor/one-page`. Read affordance only; no inline preview.
8. `TalkingPointsCard` — pre-ranked talking points, mostly read-only. Includes an explainer "?" button (see "Explainer modals" below).
9. `HypothesesCard` — 3-6 hypothesis blocks, each rendered inline with full evidence. Explainer "?" button. **No per-hypothesis detail page** (see "Drill-in question" below).
10. `CIENextActionsCard` — recommended actions, ranked. No interaction beyond the trailing "stale" indicator if the KB doc is old.
11. `OutstandingTestsCard` — explainer "?" button.
12. `ChallengerCard` — KB challenger summary. No interaction.
13. `UpcomingAppointmentsCard` — appointment list, no interaction.
14. `CrossAppointmentCard` — coverage gaps. No interaction.
15. `SinceLastVisitCard` — diff against last visit. No interaction.
16. `DataFindingsCard` (bucket-gated on `labs`) — recharts line charts with hover tooltips. Explainer "?" button. Tooltips are the only interactive surface.
17. `CyclePhaseFindingsCard` (bucket-gated on `cycle`) — read-only.
18. `MedicationsAllergiesCard` — read-only.
19. `MedicationDeltasCard` — read-only.
20. `WrongModalityCard` (bucket-gated on `imaging`) — read-only.
21. `QuickTimelineCard` — events as a list. No interaction.
22. `StaleTestsCard` — read-only.
23. **Test navigator link card** — single underlined link to `/v2/insurance/tests`.
24. `FollowThroughCard` — read-only.
25. `WeeklyNarrativeCard` — has a Refresh button (with disabled-during-fetch state).
26. `ResearchContextCard` — explainer "?" button.
27. `CompletenessFooterCard` — the data-completeness footnote. Read-only.

## Explainer modals (tap-to-learn pattern)

Five panels render an explainer "?" button next to their title via `DoctorPanelHeader`. Tap opens a modal `Sheet` with educational content:

| Card | Modal | What it explains |
| --- | --- | --- |
| TalkingPointsCard | `TalkingPointsExplainer` | What the ranking heuristic is and why these 7 are surfaced. |
| HypothesesCard | `HypothesesExplainer` | Confidence categories (ESTABLISHED / PROBABLE / POSSIBLE / SPECULATIVE / INSUFFICIENT) and the rising/falling/stable arrows. |
| OutstandingTestsCard | `OutstandingTestsExplainer` | What "ordered but not resulted" means and why it matters. |
| DataFindingsCard | `DataFindingsExplainer` | Reference range bands and abnormal-flag treatment. |
| (any) | various | Each has a 32-px hit target with a 22-px visible button. The hit target uses an absolute-positioned aria-hidden span (see "Touch-target overflow" below). |

The explainers are pedagogy, not navigation. They do not change what the page shows; they only describe how to read it. This is the closest the page has to "Show this?" — but it shows a definition, not the underlying data.

## Touch-target overflow

`DoctorPanelHeader.tsx` wraps the visible 22-px "?" circle in an aria-hidden 44-px touch overlay (`var(--v2-touch-target-min)`) using `position: absolute` with `transform: translate(-50%, -50%)`. This intentionally extends the hit area past the visible button's bounds for accessibility. It also makes the button's `scrollWidth` larger than its `clientWidth` (a 32 vs 22 mismatch on tested viewports). The new E2E overflow contract in `tests/e2e/v2-doctor.spec.ts` excludes elements with `clientWidth < 60` so this pattern does not produce false-positive failures while still catching real card overflow.

## Specialist toggle (the only real "tab-like" surface)

The closest thing to "tabs" on the page is `SpecialistToggleRow`. It is a `SegmentedControl` (radio-like, single-select) with three options: PCP, OB/GYN, Cardiology. Selecting changes `view` state on `DoctorClientV2`, which propagates to every card and triggers `bucketVisible()` filtering on lab / cycle / imaging buckets. There is no scroll-to-section behaviour, no quick-jump anchors, and no chat / question affordance.

If the brief's "Hypotheses / Next actions" tabs referred to a quick-jump nav, **the current code does not implement one**. Cards render top-to-bottom. The fix for "I want to jump to hypotheses" is `Cmd-F` or scroll, not a tab.

## What is not here

- No drill-in detail page per hypothesis. Each hypothesis renders inline with all its evidence (supporting / contradicting / what would change my mind / alternatives) and the panel-level explainer.
- No quick-question chat shortcut. The chat surface lives at `/v2/chat`; the doctor page does not link out to it with prefilled questions.
- No "save snapshot" or "share with another clinician" affordance beyond the printable `/v2/doctor/one-page` handoff and the Export PDF top-bar action.
- No filtering by date range or system. The specialist toggle is the only filter.

## Self-distrust prelude

The brief specifically called out the "Data Limitations First" block (frame 0057) as the user-visible expression of the self-distrust principle. In the current code that surface is the `CompletenessFooterCard` plus the partial-failure banner that appears above red flags when queries fail. The completeness card lives at the bottom of the page — last in scroll order — not at the top. The new E2E test `tests/e2e/v2-doctor.spec.ts` asserts that the heading "Data completeness" exists and is reachable; it does **not** assert position because both bottom and top placements are reasonable defaults.

If the redesign moves the completeness card up (so the doctor reads "what we don't know" before the hypotheses), the E2E test continues to pass. If it gets collapsed behind an info icon, the test starts failing because the heading would no longer be in the static DOM.

## Drill-in question for the user

The brief flagged this as a "request user input" item. The current behaviour is:

- 3 to 6 hypothesis blocks render inline.
- Each block shows: name + score + arrow + confidence badge, plus four bulleted lists (supporting, contradicting, what would change my mind, alternatives).
- A doctor scrolling past the hypothesis card sees roughly 200-400 px per hypothesis.

A drill-in detail page would change this to: hypothesis blocks shrink to a one-line summary (name + score + arrow + tap target). Tapping opens a dedicated route (e.g. `/v2/doctor/hypothesis/[name]`) with the full evidence + explainer + the most-uncertainty-reducing test + a sketch of the mechanism. The patient-facing version of this would also explain what each test feels like.

**Open question for the user.** Two routes here are reasonable:

- **A. Inline status quo.** Doctor scans the brief and reads everything in 60 seconds. No tap required. Trade-off: 6 hypotheses × ~300 px is a long page, and re-finding a specific hypothesis after scrolling past requires Cmd-F.
- **B. Add drill-in.** Doctor sees a 6-row table at top (name, score, arrow), taps to expand. Trade-off: a tap is one more action during a visit, but it lets the doctor compare hypotheses side-by-side instead of in vertical sequence.

I have NOT implemented either. This is a meaningful product decision and the brief explicitly asked for input before building.

## What this audit did not cover

- Print preview / PDF export visual quality (`usePdfExport`).
- The `/v2/doctor/one-page` printable handoff (separate route).
- The `/v2/doctor/care-card` and `/v2/doctor/cycle-report` siblings (separate routes).
- The `/v2/doctor/post-visit` form (separate route).

Those each warrant their own audit if the redesign extends to them.
