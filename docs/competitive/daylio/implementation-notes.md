# Daylio Implementation Notes (Top 3 Features)

---

## Feature 1: Lite Log (30-second entry path)

**Summary:** A single-card entry flow at the top of `/log` that lets Lanae record mood + a few activity icons in under 30 seconds, for low-energy days. Does not replace the full log. Lives side-by-side.

### File targets

- **New:** `src/components/log/LiteLogCard.tsx` - single unified card combining 5-face mood row + activity icon grid + optional voice note button. Renders above the LogCarousel.
- **New:** `src/components/log/ActivityIconGrid.tsx` - reusable tap-to-toggle icon grid component. Groups icons by category.
- **Modify:** `src/app/log/page.tsx` or parent of LogCarousel - render `<LiteLogCard />` conditionally (default on for low-energy mode, toggle in settings).
- **Modify:** `src/lib/api/mood.ts` - no schema change needed. Existing saveMood supports mood_score + emotions. For activities, extend.
- **New:** `src/lib/api/custom-trackables.ts` - if not already present, add upsert-by-log-id helpers for quick toggle writes to `custom_trackable_entries`.
- **Migration:** `src/lib/migrations/013_daylio_lite_log.sql` - seed default activity icons in `custom_trackables` if not seeded.
- **Existing reused:** `MoodCard.tsx` (fonts, face row styling patterns), `MoodQuickRow.tsx` (quick single-line tap pattern), `CustomFactorsCard.tsx` (toggle factor patterns).

### Data model

- `mood_entries` table (exists, migration 009): `mood_score INTEGER 1-5`, `emotions TEXT[]`. Writes by `saveMood()`.
- `custom_trackables` table (exists, migration 009): `name`, `category`, `input_type='toggle'`, `icon`, `display_order`. Seed with Lanae-relevant rows.
- `custom_trackable_entries` (exists, migration 009): `log_id`, `trackable_id`, `toggled`. Upsert on toggle.
- Migration 013 is READ-ONLY except for seeding rows in `custom_trackables`. No schema changes required.

**Default seed rows for `custom_trackables`** (POTS + endo + chronic illness specific):

```
('Lying flat', 'activity', 'toggle', 'bed', 10),
('Compression socks', 'activity', 'toggle', 'socks', 20),
('Salt + electrolytes', 'activity', 'toggle', 'salt', 30),
('Standing >1hr', 'factor', 'toggle', 'stand', 40),
('Long shower/bath', 'activity', 'toggle', 'bath', 50),
('Skipped meal', 'factor', 'toggle', 'skip-meal', 60),
('Coffee', 'activity', 'toggle', 'coffee', 70),
('Gentle movement', 'activity', 'toggle', 'walk', 80),
('Cramps', 'symptom', 'toggle', 'cramp', 90),
('Heavy flow day', 'symptom', 'toggle', 'flow', 100),
... etc, about 25-30 rows
```

### Component plan

**LiteLogCard.tsx** structure:
```
<Card>
  <Header>How are you today?</Header>
  <MoodFaceRow />            (reuse MoodCard's face row, exported as subcomponent)
  <ActivityIconGrid />       (new, below)
  <SaveIndicator />
  <Footer>
    <Button>Voice note</Button>   (opens VoiceNote)
    <Button>Full log</Button>     (scrolls to LogCarousel)
  </Footer>
</Card>
```

**ActivityIconGrid.tsx** structure:
```
<div>
  { groups.map(group => (
    <Group label={group.category}>
      { group.items.map(item => <IconTile toggled onClick upsert />) }
    </Group>
  )) }
</div>
```

Icon rendering: use `lucide-react` (already likely in deps for Next.js 16 apps) or raw SVG from a seed set. Match sage/blush palette. Keep tiles 64x64px minimum for 44px touch target compliance.

### Acceptance criteria

1. Opening `/log` shows LiteLogCard above any existing log content.
2. Tapping a mood face writes `mood_entries` row with `mood_score` for today's log.
3. Toggling any activity icon upserts `custom_trackable_entries` row with `toggled=true/false` within 500ms.
4. Elapsed time from page open to saved mood + 3 activities is < 30 seconds (manual timing test).
5. No typing required anywhere in the flow.
6. Works offline via existing `OfflineQueueIndicator` / queue system.
7. Does not break the existing full LogCarousel.

### Verification plan

1. `npm run build` passes.
2. `npm test` adds a unit test for `ActivityIconGrid` toggle behavior.
3. Apply migration 013 via `scripts/run-migration.mjs`.
4. Verify 25-30 rows in `custom_trackables` by direct Supabase query.
5. On port 3005, log in as Lanae, visit `/log`, confirm LiteLogCard renders.
6. Tap a mood face, verify `mood_entries` row by direct query.
7. Tap 3 activities, verify 3 `custom_trackable_entries` rows with `toggled=true`.
8. Toggle off one activity, verify row updated to `toggled=false`.
9. Screenshot the final card.

### Risks

- If LiteLogCard duplicates mood saves with the existing LogCarousel's MoodCard, the user may see confusing double-save or stale data. Solution: both write to same `mood_entries` row via `saveMood()`, which upserts.
- Icon choice conflict with design system. Mitigation: pick 1 icon family, wrap in styled component so swap is trivial.
- Seed rows may duplicate if migration is run twice. Use `ON CONFLICT DO NOTHING` with `UNIQUE(name)` (already present).
- Performance if the grid has 30+ icons. Mitigation: virtualize or lazy-render groups.

---

## Feature 2: Year-in-Pixels view

**Summary:** A calendar heatmap of 365 squares, each colored by a selected metric for that day (mood, pain, fatigue, sleep, flow, HRV). Cycle phase overlay. Lives on Patterns page or new `/year` route.

### File targets

- **New:** `src/components/patterns/YearInPixels.tsx` - the grid component. 12 columns (months), 31 rows (days).
- **New:** `src/lib/api/year-heatmap.ts` - server-side data fetcher. Reads `daily_logs`, `mood_entries`, `cycle_entries`, `oura_daily` and flattens to `{ date, mood, pain, fatigue, sleep, hrv, flow, cycle_phase }[]`.
- **Modify:** `src/app/patterns/page.tsx` - add a new tab/section labeled "Year" that renders `YearInPixels`.
- **Modify:** `src/components/patterns/PatternsClient.tsx` - route to the new section.
- **Existing reused:** `CyclePhaseTip.tsx` for cycle phase color logic, `TrendChart.tsx` for reference on data shaping.
- **No migration required.**

### Data model

No schema changes. Reads from existing tables.

Query (simplified, via new API route `src/app/api/year-heatmap/route.ts` or server component):

```sql
SELECT
  dl.date,
  me.mood_score,
  dl.overall_pain,
  dl.fatigue,
  od.sleep_score,
  od.hrv_avg,
  ce.flow_level,
  dl.cycle_phase
FROM daily_logs dl
LEFT JOIN mood_entries me ON me.log_id = dl.id
LEFT JOIN oura_daily od ON od.date = dl.date
LEFT JOIN cycle_entries ce ON ce.date = dl.date
WHERE dl.date >= CURRENT_DATE - INTERVAL '365 days'
ORDER BY dl.date ASC
```

### Component plan

**YearInPixels.tsx** structure:
```
<Card>
  <Header>
    Your year at a glance
    <MetricSelect options={[mood, pain, fatigue, sleep, flow, hrv]} />
  </Header>
  <Grid>
    { months.map(m => (
      <Column label={monthName(m)}>
        { days.map(d => <Square color={colorFor(data[d], selectedMetric)} />) }
      </Column>
    )) }
  </Grid>
  <Legend />
  <CyclePhaseToggle />
</Card>
```

Color scale:
- Mood 5 (Great) = sage green, Mood 1 (Terrible) = blush pink, intermediate interpolated.
- Pain 0 = cream, Pain 10 = blush strong.
- Missing data = `--bg-elevated` light gray (distinct from zero values).
- Cycle phase overlay: 1px colored border (menstrual = red, ovulatory = yellow, luteal = purple, follicular = green).

Square size: 14px x 14px with 2px gap. 12 months x 31 days fits a ~200px x ~500px area, scrollable on mobile.

### Acceptance criteria

1. Visiting `/patterns` shows a "Year" tab.
2. Grid renders 365 squares in 12 columns, one column per month.
3. Today's square has a highlighted border.
4. Missing days render as light gray, not the "bad mood" color.
5. Hovering (or tapping on mobile) a square shows a tooltip with the date and the metric value.
6. Metric selector toggles color logic instantly.
7. Cycle phase border overlay toggles on/off.
8. Colorblind-safe: uses hue + saturation differences, not red-green only.

### Verification plan

1. `npm run build` passes.
2. Unit test for `colorFor()` mapping function across metric ranges.
3. Run locally on port 3005.
4. Verify grid renders with Lanae's real data: confirm February 2026 lab test day is highlighted if flag-related color chosen.
5. Verify Oura sleep days (Lanae has 1,187 Oura days) color correctly.
6. Verify cycle days from `nc_imported` or `cycle_entries` color correctly under flow metric.
7. Screenshot the Patterns > Year view.

### Risks

- Sparse mood_entries at rollout (Lanae's daily_logs are scaffold rows, mood_entries is low). Mitigation: prioritize Lite Log (Feature 1) rollout first so future data populates the grid.
- Long data query. Mitigation: index on `daily_logs.date`, limit to 365 days, cache response.
- Accessibility. Screen reader support: add `aria-label` per square with date + metric value. Legend is required.

---

## Feature 3: Top 5 factors on Best vs Worst days

**Summary:** A side-by-side card on the Patterns page. Left: top 5 most common activities/factors/symptoms on Lanae's highest-mood days. Right: top 5 on her lowest-mood days. No statistical test, just frequency.

### File targets

- **New:** `src/components/patterns/BestWorstDaysCard.tsx` - the UI component.
- **New:** `src/lib/api/best-worst-days.ts` - server-side query + aggregation.
- **Modify:** `src/app/patterns/page.tsx` - include the new card in the layout.
- **Modify:** `src/components/patterns/PatternsClient.tsx` - include in tab structure.
- **Existing reused:** `CorrelationCards.tsx` as styling reference.
- **No migration required.**

### Data model

No schema changes. Reads from `mood_entries` joined to `custom_trackable_entries` (and optionally `symptoms`, `food_entries`, `oura_daily`).

Algorithm:
1. Get all `mood_entries` in last 90 days (configurable window).
2. Bucket by mood_score: "Best" = score 4-5, "Worst" = score 1-2, "Neutral" = 3.
3. For each bucket, for each `log_id`, fetch all `custom_trackable_entries` with `toggled=true`.
4. Count frequency per trackable name, divide by bucket size = "% of best days with X".
5. Sort descending, top 5 per bucket.
6. Present side by side.

### Component plan

```
<Card>
  <Header>Your Best vs Worst Days</Header>
  <SubHeader>Based on last 90 days</SubHeader>
  <TwoColumn>
    <Column label="Best Days" color="sage">
      <ol>
        <li>{icon} Compression socks - 82% of best days</li>
        <li>{icon} Sage → 74%</li>
        ...
      </ol>
    </Column>
    <Column label="Rough Days" color="blush">
      <ol>
        <li>{icon} Standing >1hr - 88% of rough days</li>
        <li>{icon} Skipped meal - 71%</li>
        ...
      </ol>
    </Column>
  </TwoColumn>
  <FootNote>These are patterns, not causes. Ask your doctor before changing routines.</FootNote>
</Card>
```

### Acceptance criteria

1. Visiting Patterns page shows a Best/Worst card.
2. If fewer than 10 mood entries exist, empty state appears: "Log mood for 10+ days and this card will light up."
3. Top 5 per bucket, in frequency order, with percentages.
4. Footnote about correlation vs causation is always shown.
5. Icons match the trackable's `custom_trackables.icon` value.
6. No statistical p-values surfaced (keeping it at frequency level).

### Verification plan

1. `npm run build` passes.
2. Unit test for `aggregateBestWorst()` function with seed data.
3. Manually write 15 mock `mood_entries` + `custom_trackable_entries` in dev Supabase.
4. Verify card renders top 5 correctly.
5. With Lanae's real data, verify the query runs in < 500ms.
6. Screenshot the card.

### Risks

- Small samples produce misleading percentages. Mitigation: empty state until 10+ entries. Show n=X note at bottom of each column.
- Overlapping trackables (e.g., "Coffee" appears on both Best and Worst). Not a bug, surface both columns as-is; the interesting finding is which side dominates.
- Potential to surface distressing patterns ("Skipped meal → 71% of rough days" could sound blame-y). Mitigation: lean into the positive column first. Word the Worst column as "Common on rough days" not "Causes rough days".
- If Lite Log (Feature 1) is not yet shipped, the `custom_trackable_entries` table is sparse. Empty state critical.

---

## Sequencing recommendation

1. Ship **Feature 1 (Lite Log)** first. It generates the data the other two features depend on.
2. Ship **Feature 3 (Best vs Worst)** second. It is the smallest (S effort) and becomes useful after 2-3 weeks of Lite Log data.
3. Ship **Feature 2 (Year-in-Pixels)** third. Visual payoff grows as the grid fills. Also uses Oura data already populated for past months, so pain/fatigue/sleep metrics will look rich even on day 1.
