# Apple Health -- Implementation Notes (Top 3)

Detailed implementation guidance for the top 3 features from plan.md.

---

## Feature 1: Unified Medical Records Timeline

### File targets
- **Modify:** `/Users/clancybond/lanaehealth/src/app/records/page.tsx` (add server-side merge of all record types into a single chronological stream)
- **Modify:** `/Users/clancybond/lanaehealth/src/components/records/RecordsClient.tsx` (add new "All" tab as default, keep individual tabs as filters)
- **Create:** `/Users/clancybond/lanaehealth/src/components/records/UnifiedTimeline.tsx` (single chronological list component)
- **Create:** `/Users/clancybond/lanaehealth/src/components/records/RecordFilterChips.tsx` (category filter: All, Labs, Imaging, Appointments, Events, Meds)
- **Create:** `/Users/clancybond/lanaehealth/src/components/records/TimelineEntry.tsx` (single card rendering any record type via discriminated union)
- **Reuse:** Existing data fetching in page.tsx, existing types in `src/lib/types.ts`

### Data model
**No new tables.** Existing reads from `lab_results`, `imaging_studies`, `appointments`, `medical_timeline`. Add two additional reads:
- `health_profile.medications` (for medication changes in timeline)
- `active_problems` (for diagnosis events)

Client-side merge into a sorted array by date descending. Each entry normalized to:

```ts
type TimelineEntry = {
  id: string;
  date: string;
  kind: 'lab' | 'imaging' | 'appointment' | 'event' | 'medication' | 'diagnosis';
  title: string;
  summary: string;
  severity?: 'info' | 'warn' | 'alert';
  source: 'myAH' | 'manual' | 'oura' | 'uploaded';
  detailRoute?: string;
};
```

Read-only. No migration. No writes.

### Component plan
- New components: UnifiedTimeline, RecordFilterChips, TimelineEntry
- Reused components: existing LabCard, ImagingCard, AppointmentCard (embed inside TimelineEntry when expanded)
- Layout: vertical scroll with date dividers (sticky month headers), filter chips row at top

### Acceptance criteria
1. /records page shows a single "All" tab (default) with chronological timeline of labs + imaging + appointments + events interleaved.
2. Individual category tabs (Labs, Imaging, Appointments, Timeline) remain accessible.
3. Filter chips toggle record types in/out without page reload.
4. Sticky month/year dividers as user scrolls.
5. Tapping a record expands to detail inline, or navigates to existing detail route.
6. Empty states preserved (e.g., "No labs yet" if filter = Labs and none exist).
7. Data already present: 52 labs, 2 imaging, 5+ appointments, 7 timeline events, 6 active problems.

### Verification plan
1. Start dev server on port 3005: `npm run dev`
2. Navigate to /records
3. Verify default view shows interleaved entries with Feb 19 2026 labs, Apr 2026 imaging, Apr 13 PCP appointment all visible in correct date order
4. Apply each filter chip, verify only matching records show
5. Confirm build passes: `npm run build`
6. Add unit test for timeline merge logic: sort stability, filter correctness

### Risks
- Page performance if timeline grows (currently 70+ entries, manageable)
- Date normalization across tables (lab.date vs imaging.study_date vs appointment.date vs medical_timeline.event_date)
- Active problems don't have a clean "date" field for some rows. Use diagnosed_date or first_noted fallback.

---

## Feature 2: "Today vs Your Baseline" morning home card

### File targets
- **Create:** `/Users/clancybond/lanaehealth/src/components/home/BaselineCard.tsx`
- **Modify:** `/Users/clancybond/lanaehealth/src/app/page.tsx` (add BaselineCard to home layout after QuickStatusStrip)
- **Create:** `/Users/clancybond/lanaehealth/src/lib/api/baseline.ts` (server-side rolling-median calculation)
- **Reuse:** existing Oura data from `oura_daily`, color tokens from globals.css

### Data model
**No new tables.** Read-only from `oura_daily`.

Algorithm:
```ts
async function computeBaseline(metric: 'rhr' | 'hrv' | 'temp_deviation' | 'resp_rate') {
  // Fetch last 29 days from oura_daily (28 for baseline, 1 for today)
  // Compute median of days -28 through -1
  // Compute IQR (25th - 75th percentile)
  // Flag today as "outside range" if outside [median - 1.5 * IQR, median + 1.5 * IQR]
  // Return { today, baseline, lower, upper, isAnomaly, delta }
}
```

Server-side computation in a new API route or in the home page's async fetch. No writes.

Additive usage of existing columns: `resting_heart_rate`, `hrv_balance`, `temperature_deviation`, `respiratory_rate`.

### Component plan
- New component: BaselineCard (single card with 4 metric rows)
- Each row: metric name, today value, baseline range (e.g., "50 to 58"), anomaly badge if outside
- Visual: sage green when in range, blush when outside
- Use existing Recharts line chart (mini sparkline, 28 days) if space allows

### Acceptance criteria
1. BaselineCard renders on home page below QuickStatusStrip.
2. Shows today's RHR, HRV, wrist temp deviation, respiratory rate.
3. Each metric labeled with "Today: X" and "Typical: Y to Z".
4. Anomaly badge (blush color) appears when today's value is outside IQR bounds.
5. Empty state: "Not enough data yet" if fewer than 28 days exist (Lanae has 1,187 so this won't trigger).
6. Respects existing cream/blush/sage palette and CSS vars.
7. No em dashes in any UI text.

### Verification plan
1. Navigate to localhost:3005/ (home page).
2. Verify BaselineCard appears with 4 metrics populated.
3. Query database to manually compute baseline and confirm UI matches.
4. Check POTS-relevant: Lanae's resting pulse hovers ~48, so today's 48-ish value should be "in range". Her standing pulse 106 (from myAH) would show as anomaly IF we piped that in (future enhancement).
5. Check build: `npm run build`
6. Add unit test for median + IQR calculation.

### Risks
- Oura data lag (if sync is 1+ days behind, "today" might be empty). Fallback: use most recent available day.
- Baseline drift: if Lanae's POTS worsens, her baseline rolls up and masks the decline. Mitigation: display long-term trend line alongside 28-day baseline.
- Metric not present on all days (HRV sometimes missing). Skip rows with null today value.

---

## Feature 3: Favorites / pinned metrics on home page

### File targets
- **Modify:** `/Users/clancybond/lanaehealth/src/components/home/QuickStatusStrip.tsx` (make list user-configurable)
- **Create:** `/Users/clancybond/lanaehealth/src/components/home/PinnedMetricsConfig.tsx` (settings modal, "choose your favorites")
- **Modify:** `/Users/clancybond/lanaehealth/src/app/settings/page.tsx` (add "Home dashboard" section with link to pin config)
- **Modify:** `/Users/clancybond/lanaehealth/src/lib/api/home-config.ts` (new, wrap read/write of user preferences)
- **Migration:** new `0XX-home-favorites.sql` (additive column or new row in health_profile or new table)

### Data model
Two options, choose the simpler:

**Option A (preferred):** Add a JSONB column `home_favorites` to `health_profile` table. Schema:
```json
{
  "pinned_metrics": ["rhr", "hrv", "sleep_score", "cycle_day", "pain_level", "standing_pulse"],
  "pinned_order": [0, 1, 2, 3, 4, 5]
}
```

**Option B:** New table `user_preferences` with key/value. More flexible, more overhead. Skip unless needed later.

Migration (Option A):
```sql
-- 0XX-home-favorites.sql
ALTER TABLE health_profile
ADD COLUMN IF NOT EXISTS home_favorites JSONB DEFAULT '{"pinned_metrics":["rhr","sleep_score","cycle_day","pain_level"]}'::jsonb;
```

Additive, reversible by removing column. Default value ensures backwards compatibility.

### Component plan
- Modified QuickStatusStrip: reads home_favorites from health_profile, renders pinned metrics in pinned_order
- New PinnedMetricsConfig: modal with checkbox list of all available metrics, drag to reorder
- Available metrics (from existing data sources): RHR, HRV, wrist temp deviation, sleep score, cycle day, pain level, fatigue level, standing pulse, steps, BMI, weight, Oura readiness, body battery, mood

### Acceptance criteria
1. Home page QuickStatusStrip shows 4-6 pinned metrics based on saved preferences.
2. "Customize" link in corner of strip opens PinnedMetricsConfig modal.
3. User checks/unchecks metrics to add/remove from strip.
4. Drag handle reorders pinned metrics.
5. Save persists to health_profile.home_favorites via `src/lib/api/home-config.ts`.
6. Default favorites shown for new users (no preference set).
7. Empty state (no favorites selected) shows a polite "Pick metrics to track at a glance" prompt.

### Verification plan
1. Apply migration via `scripts/run-migration.mjs`.
2. Verify default JSON populates for Lanae's existing health_profile row.
3. Navigate to /, confirm QuickStatusStrip reflects defaults.
4. Open config modal, add "standing pulse", save.
5. Refresh page, verify standing pulse now in strip.
6. Test reorder via drag.
7. Confirm build + test: `npm run build && npm test`.
8. Add unit test for home-config.ts read/write.

### Risks
- Migration modifies existing `health_profile` table (DB rule allows additive column with approval, but flag to main session)
- Reordering UX on touch: dnd-kit or react-beautiful-dnd may be needed
- Some metrics (e.g., standing pulse from myAH) don't have daily values, need graceful "no data today" fallback
- User could pin a metric that becomes irrelevant (e.g., cycle_day during pregnancy). Acceptable for now, address later

---

## Declined Feature: HealthKit Integration

Flagged in plan.md and reiterated here: HealthKit integration is the single highest-value Apple Health pattern but requires a native iOS app with HealthKit entitlement. The web-based LanaeHealth cannot call HealthKit APIs. Proposed future path (not in scope):

1. Lightweight iOS companion app (SwiftUI)
2. HealthKit read permissions for Heart, Sleep, Activity, Cycle, Mindfulness, Mobility, Vitals, Symptoms, Nutrition
3. Daily background sync to our Supabase via authenticated endpoint
4. Read-only; don't write back to HealthKit to keep Apple Watch as source of truth

This would replace direct Oura integration for users on Apple Watch, and would eliminate manual myAH import by pulling FHIR via the iPhone Health Records API. Estimated effort: 4-6 weeks, out of current scope.
