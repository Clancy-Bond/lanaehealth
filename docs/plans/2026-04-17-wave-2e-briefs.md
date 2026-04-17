# Wave 2e Subagent Briefs

**Status:** Ready to dispatch after Wave 2d. Branch `feat/competitive-wave-2e`. Final wave before copy audit + QA.

Wave 2e scope: 5 polish + privacy + adherence features.

---

## Subagent Brief F2 — Daylio Lite Log (30-second entry)

```
MISSION: Build a 30-second lite log on /log — 5-face mood + tap-to-toggle
activity icons — for Lanae's low-energy days.

READ FIRST:
1. docs/competitive/daylio/implementation-notes.md (Feature 1)
2. src/components/log/MoodCard.tsx (existing)
3. src/components/log/MoodQuickRow.tsx (existing)
4. src/lib/api/mood.ts
5. src/lib/custom-trackables.ts

YOUR FILE OWNERSHIP:
- CREATE src/components/log/LiteLogCard.tsx
- CREATE src/lib/lite-log/activities.ts (25-30 POTS/endo-specific
  activity icons: compression socks, salt tablet, electrolytes,
  lying flat, standing > 1 hour, heat pad, etc.)
- CREATE tests
- Migration: extend mood_entries if needed for multiple entries per
  day (rank 4 deferred until user approval)
- MODIFY src/app/log/page.tsx if not contested

CONSTRAINTS:
- No shaming if user only does lite log on bad days. Lite log is a
  positive choice, not a fallback.
- Activities list curated for Lanae's conditions, not generic.
- Lucide-react icons matching sage/blush palette (not stock material)

VERIFY + COMMIT per standard pattern.
```

---

## Subagent Brief F3 — Top 5 Best vs Worst days card

```
MISSION: Side-by-side column on /patterns showing most frequent
activities on Rad days vs Awful days. Daylio-inspired.

READ FIRST:
1. docs/competitive/daylio/implementation-notes.md (Feature 3)
2. src/lib/api/mood.ts
3. src/lib/custom-trackables.ts

YOUR FILE OWNERSHIP:
- CREATE src/components/patterns/BestWorstDaysCard.tsx
- CREATE src/lib/intelligence/best-worst-aggregator.ts
- CREATE tests
- MODIFY src/app/patterns/page.tsx to mount

DATA (READ-ONLY):
- mood_entries joined with daily_logs, custom_trackable_entries

CONSTRAINTS:
- Minimum 10 entries per category (best OR worst) before rendering
- Empty state until threshold met
- NO adherence or shame framing
- Tokens

VERIFY + COMMIT.
```

---

## Subagent Brief F5 — Favorites/pinned metrics on home (EAV pattern)

```
MISSION: User-curated QuickStatusStrip on home. Use EAV pattern on
health_profile (section='home_favorites', content={items:[...]}) per
2026-04-16 audit recommendation — NO new migration needed.

READ FIRST:
1. docs/competitive/apple-health/implementation-notes.md (Feature 3)
2. src/app/page.tsx
3. src/lib/context/permanent-core.ts (health_profile is EAV)
4. src/app/api/profile/route.ts

YOUR FILE OWNERSHIP:
- CREATE src/components/home/FavoritesStrip.tsx
- CREATE src/components/settings/FavoritesEditor.tsx
- CREATE src/lib/api/favorites.ts
- CREATE tests
- MODIFY src/app/page.tsx to mount FavoritesStrip (if not contested)
- MODIFY src/app/settings/page.tsx to mount editor (if not contested)

DATA MODEL (NO MIGRATION):
- Store in health_profile as row:
  { section: 'home_favorites', content: { items: [{metric, displayAs}, ...] } }
- Read via existing profile API
- Write via existing profile API

AVAILABLE METRICS (starter set, user can add more):
- Standing pulse, HRV, RHR, body temp, cycle day, cycle phase,
  overall pain, fatigue, sleep score, readiness, top lab value

CONSTRAINTS:
- Empty state with "Add a favorite" CTA when none pinned
- Drag-to-reorder in editor
- Max 6 pinned (UI constraint)

VERIFY + COMMIT.
```

---

## Subagent Brief F7 — Bearable PRN post-dose efficacy polling

```
MISSION: Schedule a 90-minute push notification after a PRN medication
dose is logged, capturing a 2-tap effectiveness response. Migration
022 adds prn_dose_events table.

READ FIRST:
1. docs/competitive/bearable/implementation-notes.md (Feature 3)
2. src/lib/api/medication-adherence.ts
3. src/lib/notifications.ts (push subscriptions, already exist via
   migration 012)

YOUR FILE OWNERSHIP:
- CREATE src/lib/migrations/022_prn_dose_events.sql
- CREATE src/lib/migrations/run-022-prn-dose-events.mjs
- CREATE src/lib/api/prn-doses.ts (record dose, schedule poll)
- CREATE src/app/api/push/prn-poll/route.ts (cron target)
- CREATE src/components/log/PrnEffectivenessPoll.tsx (2-tap UI)
- CREATE tests

SCHEMA (022):
CREATE TABLE IF NOT EXISTS prn_dose_events (
  id uuid primary key default gen_random_uuid(),
  patient_id text not null default 'lanae',
  medication_name text not null,
  dose_amount numeric,
  dose_unit text,
  dose_time timestamptz not null default now(),
  reason text,
  poll_scheduled_for timestamptz,
  poll_sent_at timestamptz,
  poll_response text check (poll_response in ('helped', 'no_change', 'worse')),
  poll_responded_at timestamptz
);

CONSTRAINTS:
- 90-min delay default, configurable per med
- No shame on no-response (treat as valid "ignored")
- iOS PWA push reliability caveat: in-app fallback required
- Voice: "Did [med] help?" not "Did you take [med]?"

VERIFY + COMMIT.
```

---

## Subagent Brief F10 — Clue privacy settings + full ZIP export

```
MISSION: Three-toggle privacy panel plus full ZIP export of Lanae's
data. Migration 025 adds privacy_prefs table. Over-delivers vs Clue
because our data is Supabase-local.

READ FIRST:
1. docs/competitive/clue/implementation-notes.md (Feature 3)
2. src/app/settings/page.tsx
3. src/lib/context/assembler.ts (for allow_claude_context enforcement)
4. src/app/api/export/route.ts (may exist)

YOUR FILE OWNERSHIP:
- CREATE src/lib/migrations/025_privacy_prefs.sql
- CREATE src/lib/migrations/run-025-privacy-prefs.mjs
- CREATE src/lib/api/privacy-prefs.ts
- CREATE src/app/settings/privacy/page.tsx
- CREATE src/app/api/export/full/route.ts (ZIP builder, jszip in deps)
- MODIFY src/lib/context/assembler.ts (respect allow_claude_context)
- CREATE tests

SCHEMA (025):
CREATE TABLE IF NOT EXISTS privacy_prefs (
  patient_id text primary key default 'lanae',
  allow_claude_context boolean default true,
  allow_correlation_analysis boolean default true,
  retain_history_beyond_2y boolean default true,
  updated_at timestamptz default now()
);

EXPORT FORMAT:
- ZIP containing: daily_logs.csv, oura_daily.csv, nc_imported.csv,
  food_entries.csv, lab_results.csv, symptoms.csv, pain_points.csv,
  appointments.csv, medical_timeline.csv, chat_messages.json,
  health_profile.json, README.md explaining schema

CRITICAL:
- allow_claude_context=false must BLOCK assembler.ts from injecting
  patient data into Claude calls. Not just cosmetic.
- Export via authenticated route only
- Include schema README for Lanae's future portability

VERIFY + COMMIT.
```

---

## Wave 2 Complete After Wave 2e

After Wave 2e lands, dispatch:
- Copy audit subagent (non-shaming voice sweep, catches 5 pre-existing
  violations per earlier verification)
- Final matrix.md update (all 45 features shipped or declined)
- Final npm test + build confirmation
- Deploy to Vercel (standing authorization)
- Ping Lanae for visual review on production URL
