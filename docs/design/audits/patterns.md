# /patterns audit

**Purpose:** Show Lanae the trends and correlations across her health data so she can spot what changed and when.
**Files:** src/app/patterns/page.tsx, src/components/patterns/*

## Note
This audit was written after implementation because the implementation subagent was unblocked by a React hooks crash that took priority. The before-state screenshots all show the error boundary (`"Rendered fewer hooks than expected. This may be caused by an accidental early return statement."`). The after-state screenshots show the route rendering its full UI.

## Status
- **Before:** Route crashed with React hooks violation. Unusable.
- **After:** Route renders. Warm Modern vocabulary applied. Several polish items pending a second pass.

## First impression
- 375 (before): broken error card, "Try again" button
- 375 (after): Patterns title, context banner ("Studies suggest sleep quality correlates..."), Health Trends card, 30d/90d toggle, time-series chart, Recent Oura metrics grid, Cycle Overview stats, Food Triggers, Sleep Debt, Correlation cards
- 768 (after): same layout, comfortable reading width
- 1440 (after): centered content column; could use `.route-desktop-split` in a future pass to surface the correlation list on the right

## Visual hierarchy
- Page title sits above a small context banner. Good.
- Time-range toggle (30d / 90d) is directly below the chart - OK, but consider a sticky header on scroll so range is always visible while scrolling correlations.
- Correlation cards at bottom are the richest information; consider moving a summary card nearer the top.

## Clarity of purpose
- This page answers "what patterns are showing up in my data?"
- The chart carries the first answer. The correlation cards carry the second. Food triggers and sleep debt carry supporting context.
- Clear enough. Could benefit from a single "top insight of the week" hero card at the top.

## Consistency violations (fixed)
- Time-range tabs use `.pill` / `.pill-active` (consistent with other routes).
- Chart colors use palette tokens.
- Numerics in correlation cards are tabular.

## Delight factor: 7/10
The page is now rendering and the data is there. Delight-level is held back by density - there's a LOT on the screen and no progressive disclosure. Lanae would benefit from an "expand for detail" affordance on cards so the first viewport shows only 2-3 top insights and she can tap in.

## Interactive states inventory
- Time range tabs: hover, active, focus OK. Press-feedback wired.
- Correlation card links: sage "View" text link. Hover color shift works.
- Chart data points: tooltip on hover (Recharts default). No keyboard equivalent flagged.

## Empty states inventory
- "Not enough data" on partial charts - rewritten during subagent pass. Uses `.empty-state` style on the InsightCardList fallback per InsightCard.tsx.

## Microcopy audit
- "Health Trends" - fine.
- Context banner sentences are plain and warm.
- No "..." loading strings remain.
- No em dashes remain in the patterns lane.

## Fix plan

### Blockers (done during batch 2)
- [x] Fix "Rendered fewer hooks than expected" React crash - resolved during the batch-2 subagent pass
- [x] Route now returns 200

### High (done)
- [x] Warm error boundary copy
- [x] Replace spinners with shimmer/skeleton
- [x] Tabular nums on values/axes
- [x] Press-feedback on interactive elements

### Medium (deferred to a future pass)
- [ ] `.route-desktop-split` layout at ≥1024px (right rail for correlation list)
- [ ] Sticky time-range toggle
- [ ] "Top insight" hero card at top
- [ ] Collapse-by-default on secondary charts (FoodHeatmap, Hypnogram) with "Show details" affordance

### Polish (deferred)
- [ ] Swipe gestures between time ranges on mobile
- [ ] Dim chart gridlines further
- [ ] Micro-sparklines in correlation cards

## Notes
Although this audit is written after the fact, the design-decisions.md vocabulary was still applied by the implementation subagent and is reflected in the after-state screenshots. A future iteration should pick up the "Medium" and "Polish" items to push this route's delight rating higher.
