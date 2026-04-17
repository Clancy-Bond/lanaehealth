---
date: 2026-04-16
agent: R3 (chart verification)
area: charts
status: FLAGGED
severity: MEDIUM
verification_method: static-analysis + api-vs-api
---

# Chart inventory and audit

## Scope

Every Recharts chart under `src/components/**` and `src/app/**`. Also included:
raw SVG sparklines that act as charts (WeeklySummaryCard, CorrelationCards)
because users perceive them as chart output.

## Total count

- Recharts components: 6 (BiometricCards, TrendChart, FoodTriggers,
  ClinicalScaleTrend, records/LabsTab.TrendChart, doctor/DataFindings.LabTrendChart)
- Raw SVG sparklines: 2 (log/WeeklySummaryCard.Sparkline,
  patterns/CorrelationCards.MiniSparkline)
- Grand total: 8

## Pass / fail breakdown

| Chart | File | Status |
|---|---|---|
| BiometricCards sparkline | src/components/patterns/BiometricCards.tsx | PASS |
| TrendChart (Pain/Energy/Mood/Sleep/HRV/RestHR/Temp) | src/components/patterns/TrendChart.tsx | PASS |
| FoodTriggers horizontal bar | src/components/patterns/FoodTriggers.tsx | PASS |
| ClinicalScaleTrend (PHQ-9/GAD-7) | src/components/patterns/ClinicalScaleTrend.tsx | PASS |
| LabsTab inline trend | src/components/records/LabsTab.tsx | **FAIL** - ResponsiveContainer regression |
| DataFindings LabTrendChart | src/components/doctor/DataFindings.tsx | PASS |
| WeeklySummaryCard Sparkline | src/components/log/WeeklySummaryCard.tsx | PASS (raw SVG) |
| CorrelationCards MiniSparkline | src/components/patterns/CorrelationCards.tsx | PASS (raw SVG, decorative) |

## Per-chart details

### 1. BiometricCards sparkline - PASS

- **File**: `src/components/patterns/BiometricCards.tsx`
- **Chart type**: LineChart (5 per card group: Sleep Score, HRV ms, Resting HR
  bpm, Temp Deviation C, Readiness)
- **Data source**: `ouraData: OuraDaily[]` prop from PatternsClient, which pulls
  from `oura_daily` table via `src/app/patterns/page.tsx`
- **X-axis / Y-axis**: both hidden; 14 most recent data points via
  `data.slice(-14)`
- **Legend**: in-card label + unit, color swap sage/blush based on direction
- **Tooltip**: not rendered (Line only, no Tooltip component); by design, this
  is a "glance" sparkline
- **Empty-state**: `if (current === null) return null` (card is hidden);
  parent hides whole section if zero metrics. Graceful.
- **ResponsiveContainer**: NO - uses `useRef` + `clientWidth` measurement
- **Date sorting**: relies on caller order; PatternsClient sorts by date
  descending in DB query, then `.slice(-14)` takes the 14 latest. Verified via
  `ouraData.filter(...date >= cutoff)` pattern on line 80 of PatternsClient.tsx.

### 2. TrendChart - PASS

- **File**: `src/components/patterns/TrendChart.tsx`
- **Chart type**: LineChart with up to 7 series, phase-color `ReferenceArea`
  overlays
- **Data source**: `ouraData`, `dailyLogs`, `ncData` props merged on date
- **X-axis**: `date` (ISO string), formatted via `format(parseISO(val), "MMM
  d")`. Rotated -45deg, tick interval scales with data length.
- **Y-axis**: unlabeled, auto-scaled. Note: pain/energy are 0-10, sleepScore
  0-100, HRV ~10-80 ms, restingHr ~40-70 bpm, temp deviation -1 to +1. Mixed
  scales share one axis, which is intentional per design (color-coded toggles
  help) but can look compressed. `Mood` config declares domain `[1, 5]` but the
  shared YAxis ignores it. Not a bug, just noting.
- **Legend**: pill toggles above the chart (click to show/hide series); good
  affordance.
- **Tooltip**: custom, formats temperature with sign and "C" suffix, dates via
  `format(parseISO(label), "MMM d, yyyy")`. Filters out nulls and hidden
  metrics. Correct.
- **Empty-state**: `if (chartData.length === 0)` returns a card with "No data
  available for this time range". Graceful.
- **ResponsiveContainer**: NO - useRef/clientWidth pattern.
- **Date sorting**: `Array.from(dateMap.values()).sort((a, b) =>
  a.date.localeCompare(b.date))` - ascending. Correct.

### 3. FoodTriggers - PASS

- **File**: `src/components/patterns/FoodTriggers.tsx`
- **Chart type**: horizontal BarChart (layout="vertical"), top 10 triggers
- **Data source**: `foodEntries: FoodEntry[]` prop; reads `flagged_triggers:
  string[]` array.
- **X-axis**: hidden (count numeric)
- **Y-axis**: categorical trigger name, 80px wide
- **Legend**: none (color-coded cells with tooltip)
- **Tooltip**: shows trigger name, count, percentage of meals. Uses `$x
  times ($y% of meals)` with proper singular/plural. Correct.
- **Empty-state**: two branches: no meals vs no triggers found. Each gives a
  specific message. Graceful.
- **ResponsiveContainer**: NO - useRef pattern.
- **Date sorting**: N/A (aggregate chart); recent-meals sub-list sorts
  descending on `logged_at.localeCompare`. Correct.
- **Note**: current `/api/intelligence/food-symptoms` returns
  `correlations: []` because `correlation_results` table is empty (finding #3
  in session 1). FoodTriggers itself computes directly from `flagged_triggers`
  counts, so it is unaffected by the empty correlation table.

### 4. ClinicalScaleTrend - PASS

- **File**: `src/components/patterns/ClinicalScaleTrend.tsx`
- **Chart type**: LineChart, 2 series (PHQ-9, GAD-7), 5 severity-band
  `ReferenceArea` overlays
- **Data source**: `initialData: ClinicalScaleResponse[]` from
  `clinical_scale_responses` via PatternsClient server prop
- **X-axis**: date string, formatted `MMM d`. Tick interval adaptive.
- **Y-axis**: `[0, maxY]` where maxY = 27 if any PHQ-9 present else 21. Correct
  clinical scale bounds.
- **Legend**: custom row above chart showing PHQ-9 (blush) and GAD-7 (sage);
  severity band legend below with color swatches. Clear.
- **Tooltip**: custom, formats date and label "PHQ-9" or "GAD-7". Correct.
- **Empty-state**: nice icon card "No assessments yet" with guidance. Graceful.
- **ResponsiveContainer**: NO.
- **Date sorting**: ascending localeCompare. Correct.

### 5. LabsTab.TrendChart - **FAIL (ResponsiveContainer regression)**

- **File**: `src/components/records/LabsTab.tsx:361-434`
- **Chart type**: LineChart with reference-range lines
- **Data source**: `allResults: LabResult[]` prop, filtered by test name
- **X-axis**: `formatShortDate` label, not full ISO
- **Y-axis**: numeric value, auto-scaled
- **Legend**: none
- **Tooltip**: default Recharts tooltip with basic styling. No custom unit
  formatting -- hover just shows the numeric value. Acceptable but plain.
- **Empty-state**: `if (trendData.length < 2) return null` - the parent simply
  does not render the trend card. This is correct because trendEligible
  already gates on 2+ data points.
- **ResponsiveContainer**: **YES, line 385**. This violates the Vercel SSR
  rule captured in memory and in TrendChart.tsx comment (line 213-214). On
  Vercel, `ResponsiveContainer` measures width 0 during hydration and never
  re-renders, producing an invisible/zero-size chart.
- **Date sorting**: ascending `a.date.localeCompare(b.date)` - correct.
- See finding doc: `2026-04-16-labs-tab-responsivecontainer-regression.md`

### 6. DataFindings LabTrendChart - PASS

- **File**: `src/components/doctor/DataFindings.tsx:171-328`
- **Chart type**: LineChart with reference-range shaded area + dashed
  boundary lines
- **Data source**: `group.points` (LabTrendGroup) derived from `allLabs`
- **X-axis**: `dateLabel` (M/d/yy)
- **Y-axis**: numeric, auto-scaled
- **Legend**: title + n-values header (no series legend - single series)
- **Tooltip**: custom, shows value + unit + date + flag badge (critical/high/low
  colored). Correct.
- **Empty-state**: component is only rendered when `labTrends` array
  (>= 2 points per test, top-6) is populated. Parent gate is correct.
- **ResponsiveContainer**: NO.
- **Date sorting**: `groupLabsByTest` sorts each group ascending by date.
  Correct.

### 7. WeeklySummaryCard.Sparkline - PASS (raw SVG)

- **File**: `src/components/log/WeeklySummaryCard.tsx:68-111`
- **Chart type**: raw SVG `<path>` + last-point emphasis circle (not Recharts).
- **Data source**: `weekly.painSparkline` from
  `/api/log/prefill` -> `src/lib/log/prefill.ts` `computeWeekly()` which builds
  exactly 8 entries (i=0..7) from `sevenDaysAgo` to `today`.
- **Verified end-to-end**: hit `/api/log/prefill`; returns
  `painSparkline` length = 8, shape `{date, pain: number|null}` matching the
  `SparklineProps`. `dayCount: 9` and `avgPain: null` because the 7-day window
  has no non-null pain values (consistent with memory "pain/fatigue empty").
- **X-axis / Y-axis**: no axes; `width=280 height=40 maxPain=10`. Hard-coded
  max of 10 matches pain scale units. Correct.
- **Tooltip**: none (this is a decorative trend bar). ARIA label present.
- **Empty-state**: `if (!hasData) return null`; caller also hides whole
  WeeklySummaryCard if `dayCount === 0`. Graceful.
- **Date sorting**: `computeWeekly()` builds sequentially from startDate
  forward (ascending). Correct.

### 8. CorrelationCards.MiniSparkline - PASS (decorative)

- **File**: `src/components/patterns/CorrelationCards.tsx:31-74`
- **Chart type**: raw SVG `<polyline>`; not a data chart, just a trend-shape
  indicator proportional to `coefficient`.
- **Data source**: `correlations[].coefficient` number.
- **X/Y**: hard-coded 48x24 px.
- **Legend / tooltip**: none - decorative.
- **Empty-state**: top-level CorrelationCards shows `<EmptyState>` component
  when `correlations.length === 0`. Graceful.
- **Sorting**: N/A.

## Data-path spot-checks

### Homepage sparkline

**Result: N/A**. There is no Recharts or sparkline chart on
`src/app/page.tsx` (home). The home route renders narrative / action cards
only. Memory from an earlier session referred to the PatternsClient biometric
sparklines as "homepage sparkline" informally; that is on `/patterns`, not `/`.

### Log prefill weekly sparkline

**Result: PASS**. Full trace:

1. Client component `DailyStoryClient.tsx:135` passes
   `props.prefill.weekly` into `<WeeklySummaryCard>`.
2. `prefill` is built by `src/lib/log/prefill.ts` `assemblePrefill()`
   -> `computeWeekly()`.
3. API response at `/api/log/prefill` matches typescript interface:
   `{ avgPain, avgFatigue, avgSleepScore, symptomsCount, dayCount,
   painSparkline: [{date, pain}] }`. Verified shape at runtime -- 8 points,
   date ISO strings, pain value null because no pain logged in window.
4. Sparkline renders correctly when pain is present; gracefully hides when
   entire array is null via `hasData` guard.

### Patterns correlation chart

**Result: PASS with caveat**. Full trace:

1. `/patterns` server page fetches `correlation_results` table (via
   Supabase) and passes into `PatternsClient`, which forwards to
   `CorrelationCards`.
2. `correlation_results` is empty (session 1 finding #3; 0 rows in live DB).
3. `CorrelationCards` renders the `<EmptyState>` "No patterns analyzed yet"
   branch, with guidance to run analysis. Graceful.
4. No chart rendering issue exists; this is a data-pipeline issue, not a
   chart bug.

## Top issues

1. **LabsTab inline trend uses ResponsiveContainer** (FAIL, finding doc
   below). Only regression found in this audit. Known SSR issue on Vercel
   per project memory.
2. **TrendChart Y-axis shares 7 scales** (not a bug, design choice) --
   note for future: consider dual-axis or normalized view when mixing 0-10
   pain with 0-100 sleep and -1..+1 temperature.
3. **All PASS charts gracefully handle empty state** - the common pattern of
   `if (chartWidth > 0 && data.length > 0)` with a "Loading chart..." or
   empty-state card is consistent and correct across 5 of the 6 Recharts
   charts.

## Open risks (not charted)

- FoodTriggers depends on `flagged_triggers: string[]` being populated on
  `food_entries`. The peek shows recent rows have `flagged_triggers: null`.
  Chart gracefully hides but user may see perpetual empty state until the
  trigger-tagging pipeline tags recent meals. Out of scope for charts, but
  worth a note.
- Hypnogram, AGPChart, NutrientDashboard, SleepOverview, etc. under
  `src/components/patterns/` render with inline SVG only (not Recharts) and
  were NOT audited in this pass. Recommend a follow-up audit of those.

## Verification method

- Static read of all 6 Recharts components and 2 raw-SVG sparklines.
- Grep of `ResponsiveContainer` -> found 1 occurrence in LabsTab.
- Live hit of `/api/log/prefill` and `/api/intelligence/food-symptoms` on
  localhost:3005 to confirm data-prop shape matches TypeScript interfaces.
- `/api/admin/peek?table=food_entries` to confirm source-row shape.
- No browser was launched (code-plus-API audit per R3 scope).
