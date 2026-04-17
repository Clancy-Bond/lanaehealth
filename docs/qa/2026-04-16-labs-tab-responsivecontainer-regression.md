---
date: 2026-04-16
agent: R3 (chart verification)
area: charts
status: FIXED
severity: MEDIUM
verification_method: static-analysis
fixed_by: IMPL-W2A-7
fixed_date: 2026-04-17
---

# LabsTab inline trend chart uses ResponsiveContainer (SSR regression)

## One-sentence finding

`src/components/records/LabsTab.tsx:385` wraps a LineChart in
`ResponsiveContainer`, which is a known-bad pattern on Vercel SSR for this
project (captured in CLAUDE memory and the TrendChart.tsx comment on line
213-214); every other chart in the codebase switched to explicit
`useRef`-measured width.

## Expected

Follow the established project pattern: measure the parent container with
`useRef<HTMLDivElement>` + `useEffect` + `clientWidth`, then render
`<LineChart width={chartWidth} height={120} ...>` only when `chartWidth > 0`.
See `src/components/patterns/TrendChart.tsx:215-227` for the reference
implementation.

## Actual

`LabsTab.tsx:385-431`:

```tsx
<ResponsiveContainer width="100%" height={120}>
  <LineChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
    <XAxis dataKey="date" ... />
    <YAxis ... />
    <Tooltip ... />
    <ReferenceLine y={refLow} ... />
    <ReferenceLine y={refHigh} ... />
    <Line dataKey="value" ... />
  </LineChart>
</ResponsiveContainer>
```

Import on line 6 includes `ResponsiveContainer` while the rest of the codebase
(TrendChart, FoodTriggers, BiometricCards, ClinicalScaleTrend,
DataFindings.LabTrendChart) explicitly do NOT import it.

## User-visible impact

Per project memory ("Recharts SSR fix: use explicit useRef width measurement,
NOT ResponsiveContainer"), on first SSR paint on Vercel the ResponsiveContainer
measures width 0 and renders nothing; Recharts v3.8.1 does not always recover
on hydration. Users clicking "Show trend" on a lab row (e.g., Ferritin, which
is auto-expanded on mount) can see an empty/zero-height chart container until
the page is resized or re-navigated.

Needs browser confirmation to verify the exact failure mode on current Vercel
build, but the code path is demonstrably inconsistent with every other chart
in the repo and violates a standing rule.

## Verification evidence

Grep for ResponsiveContainer returned a single match:

```
lanaehealth/src/components/records/LabsTab.tsx:6:  import { ... ResponsiveContainer ... } from 'recharts'
lanaehealth/src/components/records/LabsTab.tsx:385:  <ResponsiveContainer width="100%" height={120}>
lanaehealth/src/components/records/LabsTab.tsx:431:  </ResponsiveContainer>
```

All other chart files use the useRef/clientWidth pattern, e.g.:

```
lanaehealth/src/components/patterns/TrendChart.tsx:213:  // Measure parent width after mount instead of using ResponsiveContainer,
lanaehealth/src/components/patterns/FoodTriggers.tsx:81:  // Measure parent width after mount instead of ResponsiveContainer
lanaehealth/src/components/patterns/BiometricCards.tsx:84:  // Measure sparkline container width after mount instead of ResponsiveContainer
lanaehealth/src/components/doctor/DataFindings.tsx:172:  // Measure parent width after mount instead of ResponsiveContainer
```

## Recommended action

- FIX: `src/components/records/LabsTab.tsx`
  - Remove `ResponsiveContainer` from imports on line 6.
  - Add a `chartRef` + `chartWidth` state + `useEffect` measure block to the
    `TrendChart` subcomponent inside LabsTab.
  - Replace the `<ResponsiveContainer width="100%" height={120}>` wrapper with:
    ```tsx
    <div ref={chartRef} style={{ width: '100%', height: 120 }}>
      {chartWidth > 0 && (
        <LineChart width={chartWidth} height={120} data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          ...
        </LineChart>
      )}
    </div>
    ```
  - Keep all existing XAxis/YAxis/Tooltip/ReferenceLine/Line children unchanged.
- TEST: render `/records` with `?tab=labs`, expand the Ferritin trend, confirm
  chart renders at correct width after hydration on both localhost and a
  Vercel preview build.

## Fix applied (IMPL-W2A-7, 2026-04-17)

- Removed `ResponsiveContainer` from the imports (line 6) of
  `src/components/records/LabsTab.tsx`.
- Added `useEffect` to the react imports.
- Added `chartRef` (useRef<HTMLDivElement>) and `chartWidth` (useState number)
  to the `TrendChart` subcomponent, plus a `useEffect` that measures
  `chartRef.current.clientWidth` on mount and on window resize.
- Replaced the `<ResponsiveContainer width="100%" height={120}>` wrapper with
  `<div ref={chartRef} style={{ width: '100%', height: 120 }}>` that only
  renders the `LineChart` when `chartWidth > 0`, passing `width={chartWidth}`
  explicitly. This matches the pattern in
  `src/components/patterns/TrendChart.tsx:213-227`.

## Verification

- `npx vitest run`: 283/285 passed; the 2 remaining failures are pre-existing
  (anovulatory-detection and phase-insights) and unrelated to this fix.
- `curl http://localhost:3005/records`: HTTP 200.
- Grep for `ResponsiveContainer` in `LabsTab.tsx` returns only the explanatory
  code comment, no JSX usage.
