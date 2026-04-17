# Headache Diary -- Implementation Notes (Top 3)

---

## Feature 1: HIT-6 + MIDAS validated clinical scales

### File targets
- `/Users/clancybond/lanaehealth/src/lib/clinical-scales.ts` (MODIFY, extend existing file)
- `/Users/clancybond/lanaehealth/src/lib/types.ts` (MODIFY, add HIT-6, MIDAS to ClinicalScaleType union)
- `/Users/clancybond/lanaehealth/src/components/log/ClinicalScaleModal.tsx` (verify existence; reuse if present, otherwise grep for existing PHQ-9 surface and follow pattern)
- `/Users/clancybond/lanaehealth/src/app/log/page.tsx` (MODIFY, add scale entry points)

### Data model
- No new table. Reuse the existing clinical_scale_results surface (wherever PHQ-9 stores). If none exists for PHQ-9 yet, create `clinical_scale_results` in migration 013 with columns: id, date, scale_type (text), responses (jsonb), total_score (int), severity (text), created_at.
- Column conventions for severity to support MIDAS grades I-IV: extend ScaleSeverity union with `grade_1` `grade_2` `grade_3` `grade_4` OR add a parallel `midas_grade` column. Defer to the type design.
- HIT-6 thresholds per IHS: <=49 little/no impact, 50-55 some, 56-59 substantial, >=60 severe.
- MIDAS grades per IHS: 0-5 grade I (minimal), 6-10 grade II (mild), 11-20 grade III (moderate), 21+ grade IV (severe).

### Component plan
- Reuse existing ClinicalScaleModal (or equivalent) pattern from PHQ-9/GAD-7
- New entry point chips on /log under a "Headache assessment" section
- Results card showing current score + 90-day trend sparkline

### Acceptance criteria
- HIT-6 6-question set with 5-point Likert responses (never, rarely, sometimes, very often, always) scored at 6, 8, 10, 11, 13
- MIDAS 5-question set (days of missed work, reduced work, missed household, reduced household, missed social) + 2 context (headache-days, avg pain)
- Both produce total + severity/grade + color per getSeverityColor pattern
- Results persisted to clinical_scale_results with scale_type = 'HIT-6' or 'MIDAS'

### Verification plan
- npm run build passes
- Unit tests for scorePHQ9, scoreGAD7, scoreHIT6, scoreMIDAS in tests (extend existing tests if present)
- Manual: log a HIT-6 with all 6 "always" responses -> 78 -> severe, verify card displays
- Manual: log a MIDAS with 21+ total -> grade IV -> severe
- Verify against Lanae's real Supabase at port 3005 /log page

### Risks
- If clinical_scale_results table does not yet exist for PHQ-9, migration 013 required; main session must approve migration number
- ScaleSeverity type extension could break existing PHQ-9/GAD-7 consumers; add gradesafely with a union widen, not replace

---

## Feature 2: Aura tracking multi-category (ICHD-3)

### File targets
- `/Users/clancybond/lanaehealth/src/lib/migrations/013_headache_diary.sql` (NEW, adds headache_attacks table; aura_symptoms JSONB column)
- `/Users/clancybond/lanaehealth/src/lib/types.ts` (MODIFY, add AuraSymptom type + HeadacheAttack interface)
- `/Users/clancybond/lanaehealth/src/lib/api/headache.ts` (NEW, domain API wrapper per section 4 of design-decisions.md)
- `/Users/clancybond/lanaehealth/src/components/log/headache/AuraSelector.tsx` (NEW)
- `/Users/clancybond/lanaehealth/src/app/log/headache/page.tsx` (NEW, hosts the attack log form)

### Data model
- Migration 013 adds `headache_attacks` (all columns used by features 1-3):
  - id uuid pk default gen_random_uuid()
  - patient_id uuid
  - started_at timestamptz not null
  - ended_at timestamptz null
  - duration_minutes int generated always as (EXTRACT(EPOCH FROM (ended_at - started_at))/60) stored
  - pain_intensity_peak int (0-10)
  - pain_qualities text[] (subset of PainType enum plus pulsating)
  - pain_locations text[] (frontal_l, frontal_r, frontal_c, temporal_l, temporal_r, orbital_l, orbital_r, parietal, occipital, vertex, c_spine)
  - aura_symptoms jsonb (structured: { visual: string[], sensory: string[], speech: string[], motor: string[], duration_minutes: int })
  - premonitory_symptoms text[] (yawning, food_cravings, neck_stiffness, mood_change, fatigue)
  - postdrome text[] (fatigue, cognitive_slowing, mood_low)
  - triggers_suspected text[] (multi-select from trigger library)
  - medications_taken jsonb[] (name, dose, time_taken, time_to_relief_minutes, effectiveness_0_10)
  - notes text
  - cycle_phase text nullable (auto-computed at write time from cycle_entries; denormalized for fast query)
  - cycle_day_relative int nullable (signed integer from menstruation start)
  - created_at timestamptz default now()
  - updated_at timestamptz default now()
- All columns additive. cycle_entries remains read-only, used only for lookup at write time.

### Component plan
- AuraSelector: 4 category sections (Visual, Sensory, Speech, Motor) with 44px chips per ICHD-3 symptom list
  - Visual: scintillating scotoma, fortification spectra, zigzag lines, blurred vision, visual loss
  - Sensory: paresthesias (tingling), numbness, pins-and-needles march
  - Speech: word-finding difficulty, slurred speech
  - Motor: weakness one side (hemiplegic migraine flag, requires clinical follow-up)
- Plain-language label + clinical label on tap per voice rule
- Duration slider 5-60 min per ICHD-3 typical

### Acceptance criteria
- User selects 0+ aura categories; stores to aura_symptoms JSONB
- Motor aura selection triggers an informational card "hemiplegic migraine is rare; triptans contraindicated. Please discuss with neurology."
- Persists via src/lib/api/headache.ts -> Supabase; no direct client writes

### Verification plan
- Migration 013 runs against Supabase via scripts/run-migration.mjs
- Log a test attack with visual + sensory aura -> verify row in headache_attacks
- Motor aura -> warning card appears
- Empty aura selection -> still persists (aura is optional)

### Risks
- Hemiplegic migraine warning could alarm without proper UX; phrase as advisory, not diagnostic
- ICHD-3 terminology must be plain-language first, clinical on tap

---

## Feature 3: One-tap during-attack logging with auto-timer

### File targets
- `/Users/clancybond/lanaehealth/src/app/log/headache/active/page.tsx` (NEW, active attack UI)
- `/Users/clancybond/lanaehealth/src/components/log/headache/AttackTimer.tsx` (NEW)
- `/Users/clancybond/lanaehealth/src/components/log/headache/QuickPainSlider.tsx` (NEW)
- `/Users/clancybond/lanaehealth/src/components/log/headache/AttackPostLogForm.tsx` (NEW, post-attack detail form)
- `/Users/clancybond/lanaehealth/src/lib/api/headache.ts` (EXTEND, add startAttack, updateAttack, endAttack)
- `/Users/clancybond/lanaehealth/src/components/log/AnatomicalBodyMap.tsx` (MODIFY, zoomed head view when head region selected)
- `/Users/clancybond/lanaehealth/src/app/log/page.tsx` (MODIFY, add "Headache active" floating button entry point)

### Data model
- Uses headache_attacks table from feature 2
- Start attack: INSERT with started_at = now(), ended_at = null, minimal other fields
- During: UPDATE pain_intensity_peak, pain_locations via optimistic UI
- End attack: UPDATE ended_at = now(); duration_minutes computed automatically (Postgres generated column)

### Component plan
- Floating persistent "Headache active" entry point on /log page (subtle, not obtrusive)
- Active route at /log/headache/active shows:
  - Large elapsed timer (hh:mm:ss)
  - Pain slider 0-10 with --pain-* color scale
  - Head zone tap target (simplified 6-zone map: frontal L/R, temporal L/R, occipital, vertex)
  - Single "Took medication" quick-action + side sheet for detail
  - Large "Attack ended" button at bottom
- After end: redirect to /log/headache/[id]/detail for post-attack form (aura, triggers, medications effectiveness, notes)

### Acceptance criteria
- Tapping "Headache active" inserts a row in headache_attacks with started_at = now()
- Timer updates every second without forcing full re-render (useInterval + ref)
- Pain + location edits persist via debounced API calls
- "Attack ended" writes ended_at and navigates to detail form
- Detail form can be saved later; empty state OK
- Minimum 44px touch targets per WCAG rule
- No spinners for loads > 200ms (use skeleton)

### Verification plan
- End-to-end: start attack -> wait 2 min -> set pain 8 -> select temporal_r -> took medication (triptan) -> end attack -> fill aura post-hoc
- Verify headache_attacks row has correct started_at, ended_at, duration_minutes (~120 sec), pain_intensity_peak 8, pain_locations ['temporal_r']
- Verify cycle_phase populated from cycle_entries at insert time
- Screenshot at /log/headache/active on port 3005

### Risks
- Users may forget to end attack -> stale active attacks. Mitigate with: if started_at > 72 hr ago, show "still ongoing?" prompt with default end time = started_at + 12 hr
- Battery drain from 1Hz timer updates. Mitigate with visibility-change handler, pause updates when tab hidden
- AnatomicalBodyMap is used elsewhere; the head-zoom must be optional, not change default behavior

---

## Cross-cutting concerns

### Embeddings pipeline
Per rule 6.6 of design-decisions.md: narrative text worth searching must chunk per-day to health_embeddings. Add a post-attack hook that generates a narrative string ("Oct 12: migraine, 2h 45min duration, peak pain 8/10, right temple, aura visual scintillating, took sumatriptan 50mg with relief in 35min") and writes to health_embeddings with content_type = 'headache_attack', pain_level, cycle_phase metadata.

### Doctor Mode export
Extend existing Doctor Mode report to include a Headache section:
- Last 90 days attack count + frequency
- Current HIT-6 and MIDAS with trend
- Medication log with overuse flag
- Triggers with confidence
- Cycle correlation summary (once Phase E classifier ships)

Reuses existing Doctor Mode structured report infrastructure; no new PDF library required.

### Claude API integration
Menstrual migraine classifier (Phase E, not in top-3) will call Claude via src/lib/context/assembler.ts. System prompt cached, dynamic data (headache_attacks + cycle_entries summary) after boundary marker. Model: claude-sonnet-4-6.

### Voice rule adherence
All user-facing copy: no em dashes. Use commas, periods, "and/or". Plain language first. "Your headaches happen most often 2 days before your period." not "Perimenstrual migraine temporal clustering detected."

---

## Files summary

New:
- src/lib/migrations/013_headache_diary.sql
- src/lib/api/headache.ts
- src/app/log/headache/page.tsx
- src/app/log/headache/active/page.tsx
- src/app/log/headache/[id]/detail/page.tsx
- src/components/log/headache/AttackTimer.tsx
- src/components/log/headache/QuickPainSlider.tsx
- src/components/log/headache/AttackPostLogForm.tsx
- src/components/log/headache/AuraSelector.tsx

Modified:
- src/lib/clinical-scales.ts (HIT-6, MIDAS)
- src/lib/types.ts (types)
- src/components/log/AnatomicalBodyMap.tsx (head zoom)
- src/app/log/page.tsx (entry point)

Read-only references:
- src/lib/api/cycle.ts (cycle phase lookup)
- src/lib/api/logs.ts (pain_points pattern reference)
- src/components/log/BodyPainMap.tsx (design pattern reference)
