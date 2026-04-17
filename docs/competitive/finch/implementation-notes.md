# Finch: Implementation Notes

Top 3 features from plan.md. Each has file targets, data model, component plan, acceptance criteria, verification plan, and risks.

---

## Feature 1: Energy-Adaptive Goal Scaling

### File targets

**Create:**
- `src/lib/log/energy-mode.ts` (new). Pure function that accepts today's Oura readiness, cycle phase, yesterday's pain, and last-night sleep hours, and returns `'minimal' | 'gentle' | 'full'`. Also returns a human-readable rationale string.
- `src/components/log/EnergyModeToggle.tsx` (new). Three-pill segmented control displayed at the top of the log page. Shows suggested mode as a soft hint. User can override.
- `src/components/log/EnergyModeBanner.tsx` (new). Small banner under toggle that says e.g. "Gentle mode suggested: readiness 52, luteal phase."

**Modify:**
- `src/app/log/page.tsx`. Fetch data needed for energy inference. Pass mode to MorningCheckIn and EveningCheckIn.
- `src/components/log/MorningCheckIn.tsx`. Accept `mode` prop. In minimal mode, render only MoodQuickRow + MedStatusCard + HydrationRow. In gentle mode, add GratitudeQuickInput. In full mode, render existing full layout.
- `src/components/log/EveningCheckIn.tsx`. Same accept `mode` pattern.

### Data model

No new tables required. Uses existing data:
- `oura_daily.readiness_score`
- `nc_imported.cycle_phase` or derived from our cycle logic
- `daily_logs.overall_pain` (yesterday)
- `oura_daily.sleep_hours`

Optional additive column on `daily_logs`:
- `energy_mode` text nullable. Records which mode the user was in that day for pattern analysis. Additive migration only.

Migration number: `013_energy_mode.sql`. Additive. Adds `energy_mode TEXT` to daily_logs. No data transformation.

### Component plan

New: EnergyModeToggle, EnergyModeBanner.
Modified: MorningCheckIn, EveningCheckIn, log/page.tsx.
Reused: all existing row components (MoodQuickRow, HydrationRow, MedStatusCard, GratitudeQuickInput, SymptomPillRow, PainRegionRow, etc.).

Mode inference algorithm (starting heuristic, tune with Lanae):
- Minimal: readiness < 50 OR yesterday pain >= 7 OR sleep < 5h OR user-marked flare
- Gentle: readiness 50-69 OR luteal/menstrual phase OR yesterday pain 4-6
- Full: readiness >= 70 AND not luteal/menstrual AND yesterday pain < 4

User override persists for the day only.

### Acceptance criteria

1. On opening /log, user sees a mode suggestion with a human rationale.
2. Switching mode hides/shows relevant rows without reloading.
3. Minimal mode shows only mood + meds + water in under one screen.
4. Selected mode saves to daily_logs.energy_mode.
5. Mode inference function has unit tests for each threshold.
6. No shaming copy: banner says "Gentle mode suggested" not "You seem tired".

### Verification plan

1. Pick a day in Lanae's history with low readiness (e.g., there are several April 2026 days with readiness < 60) and verify function returns `gentle` or `minimal`.
2. Pick a day in follicular phase with high readiness and verify `full`.
3. Check that modal displays the rationale referencing actual data: "readiness 52, luteal phase".
4. `npm run build` passes.
5. Screenshot at port 3005.

### Risks

- Mode inference could feel intrusive if wrong. Always an offer, never forced.
- Users might interpret "minimal" as judgment. Copy must be explicit: "Save energy today."
- Lanae's real data may not map cleanly; tune thresholds against her actual Oura distribution.

---

## Feature 2: Rest Day Action

### File targets

**Create:**
- `src/components/log/RestDayCard.tsx` (new). Prominent sage-tinted card on the log page with a "Mark as Rest Day" button. When active, shows "Recovery day, resting well." Also offers an undo.
- `src/lib/api/rest-day.ts` (new). Server-side functions: `markRestDay(date)`, `unmarkRestDay(date)`, `isRestDay(date)`.

**Modify:**
- `src/components/log/DailyLogClient.tsx`. Render RestDayCard above MorningCheckIn. On rest day, collapse check-in to only MoodQuickRow + MedStatusCard.
- `src/components/log/InsightBanner.tsx`. Never show "you missed" language on rest days. Show "You honored a rest day" instead.
- `src/app/api/rest-day/route.ts` (new). POST endpoint to mark/unmark.
- `src/lib/types.ts`. Add `rest_day: boolean | null` to DailyLog type.
- Any analysis/correlation code that treats empty days as gaps must be audited to treat rest days as expected.

### Data model

Additive migration `013_rest_day.sql` (or 014 if energy-mode lands first).

```sql
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS rest_day BOOLEAN DEFAULT FALSE;
```

Read-only against existing daily_logs rows (new column defaults to false).

### Component plan

New: RestDayCard, lib/api/rest-day.ts, app/api/rest-day/route.ts.
Modified: DailyLogClient, InsightBanner, types.
Reused: existing check-in components, log page layout.

Interaction flow:
1. User taps "Mark as Rest Day" in RestDayCard.
2. Optimistic UI updates card to "Recovery day, resting well."
3. Server writes rest_day = true to daily_logs via `src/lib/api/rest-day.ts`.
4. Morning/Evening check-in collapses to mood + meds only.
5. Undo button available for the rest of the day.

### Acceptance criteria

1. Log page shows Rest Day card at top, above check-ins.
2. Tapping activates rest day. Visual change is immediate (optimistic UI).
3. Check-in rows collapse to mood + meds.
4. Timeline, Patterns, and Doctor views label rest days distinctly (not as gaps).
5. Any weekly insight copy that would say "you logged X of Y days" excludes rest days from the denominator.
6. Non-shaming copy pass: all log-page copy audited for streak or deficit language, replaced with cumulative framing.

### Verification plan

1. Pick a recent day in Lanae's history. Mark as rest day. Verify daily_logs row updates.
2. Reload log page. Verify reduced UI.
3. Navigate to Patterns page. Verify rest day does not count as "missed."
4. Unmark rest day. Verify daily_logs reverts.
5. `npm run build` passes.
6. Screenshot before and after marking.

### Risks

- If users mark every day as rest day, clinical signal degrades. Mitigation: show rest day density in Doctor page so Lanae and clinicians can see the pattern without the user being shamed.
- Existing analysis runs may double-count rest days as "missed" if not updated. Audit analysis pipeline.
- Copy pass across the log page is tedious but essential. Grep for "streak", "missed", "broken", "failed" and replace.

---

## Feature 3: Micro-Care Drawer

### File targets

**Create:**
- `src/components/log/MicroCareDrawer.tsx` (new). Bottom-sheet drawer with a grid of 8 to 12 micro-care action cards.
- `src/components/log/MicroCareAction.tsx` (new). Single action card. Icon, 2-word label, tap-to-run.
- `src/lib/micro-care/actions.ts` (new). Definitions of each action (id, label, icon, category, duration_seconds, component_to_render, log_entry_template).
- `src/components/log/GroundingExercise.tsx` (new). 5-4-3-2-1 grounding flow. Five steps, each 15 seconds.
- `src/lib/api/micro-care.ts` (new). `logMicroCareCompletion(action_id, date)`.

**Modify:**
- `src/app/log/page.tsx`. Add trigger button for MicroCareDrawer.
- `src/components/log/BreathingExercise.tsx`. Refactor to be invocable from drawer with consistent API.

### Data model

Additive migration `014_micro_care.sql` (or next).

```sql
CREATE TABLE IF NOT EXISTS micro_care_completions (
  id BIGSERIAL PRIMARY KEY,
  action_id TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date DATE NOT NULL,
  duration_seconds INTEGER,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_micro_care_date ON micro_care_completions(date);
```

Read-only against existing tables. Entirely additive.

### Component plan

New: MicroCareDrawer, MicroCareAction, GroundingExercise, micro-care/actions.ts, api/micro-care.ts.
Modified: log/page.tsx, BreathingExercise.tsx.
Reused: existing BreathingExercise, HydrationRow's hydration increment logic, GratitudeQuickInput's save flow.

Action library (starting set):
1. Hydrate (water glass)
2. Salt intake (POTS)
3. Elevate legs (POTS)
4. Heat pad (endo)
5. 60-second breathing (existing)
6. 5-4-3-2-1 grounding (new)
7. Neck stretch (guided)
8. Cold wrist (POTS calming)
9. Open a window (1 minute outside)
10. One-line gratitude
11. Dim the lights (migraine support)
12. Text a friend prompt ("Sending thinking-of-you text")

Each action has a lightweight in-app experience (timer, animation, or simple prompt) and logs completion to micro_care_completions.

### Acceptance criteria

1. "Micro-care" button on log page opens drawer.
2. Drawer shows 8-12 actions with icons and labels.
3. Tapping an action runs the in-app experience.
4. Completion writes to micro_care_completions.
5. No streak counter. A cumulative "X acts of care this month" is displayed, never a streak.
6. Insights banner surfaces gently: "You've chosen care X times this week" (positive framing only).
7. Action library prioritizes POTS + endo + fatigue relevance.

### Verification plan

1. Tap each action. Verify each runs end-to-end without errors.
2. Complete a breathing session. Verify micro_care_completions row created.
3. Verify cumulative count displays on the log page.
4. `npm run build` passes.
5. Screenshot the drawer and at least one in-app experience.

### Risks

- Action library can feel generic if not tuned to chronic illness. Curate carefully.
- Over-gamification risk: if completion feels like chore, it loses value. No XP bars. Gentle visual acknowledgment only.
- New table adds schema surface; must not be used for clinical decisions, only for self-reported behavior tracking.
- BreathingExercise refactor must not break existing usage. Test current callers.

---

## Cross-cutting concerns

### Copy pass (rolls into all three)

Audit log page, insights, and notifications for any of these words and replace:
- "streak" → "showing up" or "logged" with cumulative count
- "missed" → neutral phrasing or omit
- "broken" → omit
- "failed" → omit
- "keep it up" → keep, acceptable
- "you missed X days" → delete entirely, never show

### Settings work

Add a "Pressure settings" block to the Settings page with toggles:
- Show streak count (default OFF)
- Daily reminder tone (Gentle / Standard, default Gentle)
- Goal targets visible (default user-chosen)

### Analysis pipeline audit

Any `src/lib/intelligence/` code that computes "adherence" or "compliance" rates must treat rest days as expected. Rates displayed to Lanae are "logged days / non-rest days in range" not "logged days / total days."

---

## Sequencing

Recommended order:
1. Feature 2 (Rest Day) first. Small migration, unlocks non-shaming copy pass that benefits the other two.
2. Feature 1 (Energy Mode) second. Builds on non-shaming foundation.
3. Feature 3 (Micro-Care) third. Largest surface area, benefits from Rest Day and Energy Mode being in place.

Total estimated effort: 3 M-effort features plus hygiene passes = approximately 1 to 2 weeks for a single implementation subagent.
