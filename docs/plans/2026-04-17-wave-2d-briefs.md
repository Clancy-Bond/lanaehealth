# Wave 2d Subagent Briefs

**Status:** Ready to dispatch after Wave 2c merges/rebases. Branch: `feat/competitive-wave-2d`.

Wave 2d scope: doctor-prep deep features + mood/Year-in-Pixels + baseline card. 5 parallel briefs.

---

## Subagent Brief D4 — Cover-page-first clinical PDF + specialist toggles

```
MISSION: Rebuild src/lib/reports/clinical-report.ts so the PDF opens
with a proper cover page (patient ID, diagnoses, meds, allergies,
period). Add per-section toggles integrated with existing
SpecialistToggle.

READ FIRST:
1. docs/competitive/careclinic/implementation-notes.md (Feature 1)
2. src/lib/reports/clinical-report.ts (existing)
3. src/components/doctor/SpecialistToggle.tsx
4. src/app/doctor/page.tsx

YOUR FILE OWNERSHIP:
- MODIFY src/lib/reports/clinical-report.ts (cover + toggles)
- CREATE src/lib/reports/cover-page.ts (just the cover builder)
- CREATE tests

CONSTRAINTS:
- No em dashes
- Design tokens
- Reports in /doctor may use adherence framing (clinical nuance
  exception from non-shaming-voice-rule.md)
- jsPDF already in deps, use it

VERIFY + COMMIT per standard pattern.
```

---

## Subagent Brief D5 — Condition-tagging for symptoms

```
MISSION: Add additive symptom_conditions junction table (migration
018), API, and UI affordances to tag each symptom with relevant
conditions from active_problems.

READ FIRST:
1. docs/competitive/careclinic/implementation-notes.md (Feature 3)
2. src/lib/api/symptoms.ts
3. src/lib/api/active-problems.ts (or similar)

YOUR FILE OWNERSHIP:
- CREATE src/lib/migrations/018_symptom_conditions.sql
- CREATE src/lib/migrations/run-018-symptom-conditions.mjs
- CREATE src/lib/api/symptom-conditions.ts
- CREATE src/components/log/ConditionTagSelector.tsx
- MODIFY existing symptom-log UI (find it via grep for SymptomPills)
- CREATE tests

SCHEMA (018):
CREATE TABLE IF NOT EXISTS symptom_conditions (
  id uuid primary key default gen_random_uuid(),
  symptom_id uuid not null references symptoms(id) on delete cascade,
  condition_id uuid not null references active_problems(id) on delete cascade,
  confidence text default 'explicit' check (confidence in ('explicit','inferred')),
  tagged_at timestamptz default now(),
  UNIQUE(symptom_id, condition_id)
);

CONSTRAINTS:
- symptoms, active_problems read-only on existing rows
- Foreign keys ensure integrity
- Confidence tier: explicit (user-tagged) vs inferred (from rules)

VERIFY + COMMIT.
```

---

## Subagent Brief D6 — Care Card + QR share (signed tokens)

```
MISSION: 1-page printable emergency summary at /doctor/care-card with
a 7-day expiring signed QR share link. Safety-critical for Lanae
(POTS syncope + multiple allergies).

READ FIRST:
1. docs/competitive/careclinic/implementation-notes.md (Feature 2)
2. Existing /doctor page structure
3. Next.js middleware docs (if share link goes through middleware)

YOUR FILE OWNERSHIP:
- CREATE src/lib/migrations/019_share_tokens.sql
- CREATE src/lib/migrations/run-019-share-tokens.mjs
- CREATE src/app/doctor/care-card/page.tsx
- CREATE src/app/doctor/care-card/print-actions.tsx
- CREATE src/app/api/share/care-card/route.ts
- CREATE src/app/share/[token]/page.tsx (public view)
- CREATE src/lib/api/share-tokens.ts (create, verify, expire)
- CREATE tests

SCHEMA (019):
CREATE TABLE IF NOT EXISTS share_tokens (
  token text primary key,        -- cryptographically random
  resource_type text not null,   -- 'care_card' | future types
  resource_id text,              -- optional scoping
  issued_at timestamptz default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  one_time boolean default false,
  used_at timestamptz
);

CONSTRAINTS:
- Token generated with crypto.randomBytes, 32+ bytes, base64url
- 7-day default expiry, configurable
- No PII in token itself
- Signed URL should be unauthenticated for viewer but authenticated
  to create
- Rate-limit view access (but don't over-engineer in this pass)

VERIFY + COMMIT.
```

---

## Subagent Brief F1 — Year-in-Pixels view

```
MISSION: 365-square calendar heatmap on Patterns page. Selectable
metric (mood/pain/fatigue/sleep/flow/HRV). Cycle phase border overlay.
Huge doctor-visit visual for cycle-mood-hormone correlation.

READ FIRST:
1. docs/competitive/daylio/implementation-notes.md (Feature 2)
2. src/components/patterns/ existing cards
3. CLAUDE.md Recharts rule (useRef, no ResponsiveContainer)

YOUR FILE OWNERSHIP:
- CREATE src/components/patterns/YearInPixels.tsx
- CREATE src/lib/patterns/pixel-data.ts (data shaping)
- CREATE tests
- MODIFY src/app/patterns/page.tsx to mount (if not contested by Wave
  2c mount subagent that just ran)

DATA ACCESS (READ-ONLY):
- daily_logs, oura_daily, nc_imported, cycle_entries

CONSTRAINTS:
- 365 squares arranged month-by-week (7 columns, 53 rows or similar)
- Empty cells for no-data days (not shamed)
- Cycle phase as colored border, not fill (fill = metric)
- Tokens: --pain-* scale for pain metric, --accent-* for others

VERIFY + COMMIT.
```

---

## Subagent Brief F4 — Today vs Baseline morning card

```
MISSION: Home page card comparing today's RHR, HRV, wrist temp, resp
rate vs 28-day rolling median from oura_daily (1,187 days available).
Anomaly flag in blush when outside IQR.

READ FIRST:
1. docs/competitive/apple-health/implementation-notes.md (Feature 2)
2. src/app/page.tsx (home)
3. src/lib/api/oura.ts

YOUR FILE OWNERSHIP:
- CREATE src/components/home/BaselineCard.tsx
- CREATE src/lib/intelligence/baseline.ts (rolling median + IQR)
- CREATE tests
- MODIFY src/app/page.tsx to mount (if not contested)

DATA ACCESS (READ-ONLY):
- oura_daily

CONSTRAINTS:
- 28-day rolling window
- IQR (Q1 minus 1.5 IQR to Q3 plus 1.5 IQR) = normal range
- Outside IQR = blush accent, with plain-language copy
- No diagnostic language ("your RHR is elevated" NOT "you may be sick")
- Tokens

VERIFY + COMMIT.
```

---

## Wave 2e (after Wave 2d)

Remaining features:
- F2 Daylio Lite Log (30-sec entry)
- F3 Top 5 Best vs Worst days card
- F5 Favorites/pinned metrics on home (EAV pattern, no migration)
- F7 Bearable PRN post-dose efficacy polling (migration 022)
- F10 Clue privacy settings + full ZIP export (migration 025)

Plus copy audit as final cleanup.
