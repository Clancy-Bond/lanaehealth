# Wave 2c Subagent Briefs

**Status:** Ready to dispatch after Wave 2b is merged/rebased.

**Wave 2c scope:** 5 features — nutrition AI coach, unified timelines, doctor prep, lab trends, micro-care drawer.

Dispatch branch: `feat/competitive-wave-2c` (branch from 2b once 2b merges).

---

## Dispatch checklist

- [ ] Wave 2b merged (or branched from)
- [ ] Create branch: `git checkout -b feat/competitive-wave-2c`
- [ ] Dispatch 5 subagents in parallel
- [ ] Each reads design-decisions.md + non-shaming-voice-rule.md

---

## Subagent Brief C4 — Cycle-aware AI Nutrition Coach

```
MISSION: Build Lanae's "Ria-equivalent" AI nutrition coach that routes
through assembler.ts and grounds responses in her 5,781-row food_entries
plus cycle-phase context.

READ FIRST:
1. docs/competitive/design-decisions.md
2. docs/competitive/mynetdiary/implementation-notes.md (Feature 2)
3. src/lib/context/assembler.ts (MANDATORY route through this for Claude API)
4. src/lib/api/chat.ts (existing chat infrastructure)
5. src/lib/nutrition/nutrients-list.ts (Wave 2a)
6. src/lib/api/nutrient-targets.ts (Wave 2a)
7. src/lib/intelligence/menstrual-migraine.ts (Wave 2b if committed)

YOUR FILE OWNERSHIP:
- CREATE src/lib/personas/nutrition-coach.ts (persona definition with
  static/dynamic boundary honored)
- CREATE src/lib/intelligence/nutrition-coach-context.ts (builds dynamic
  context: recent meals, nutrient gaps, cycle phase, active goals)
- CREATE src/app/api/chat/nutrition-coach/route.ts (dedicated route
  that wraps assembler.ts with the persona)
- CREATE src/components/log/NutritionCoachChat.tsx (chat UI, scoped to
  nutrition topics)
- CREATE tests
- MODIFY src/app/log/page.tsx to mount (if not contested)

VOICE CONSTRAINTS:
- NO diet prescriptions (Flo's "keto for PCOS" = anti-pattern Flo got
  sued for in 2021)
- NO weight loss framing
- Focus on nutrient-goal support, not restriction
- Cite sources when giving advice (link to ODS fact sheets, etc.)
- "Based on your last 7 days, you are tracking low on iron" not
  "You are iron-deficient" (observation, not diagnosis)

DATA ACCESS:
- food_entries: READ-ONLY
- user_nutrient_targets: READ (write via Wave 2a API only)
- chat_messages: WRITE allowed, use subject='nutrition_coach' tag to
  filter this chat from general chat

VERIFY + COMMIT per standard pattern.
```

---

## Subagent Brief D1+F6 — Unified Medical Records Timeline (merged)

```
MISSION: Merge Guava-inspired and Apple-Health-inspired timeline
concepts into one /records page redesign. Single chronological scroll,
filter chips, provider color-coding, lab trend sparklines inline.

READ FIRST:
1. docs/competitive/guava-health/implementation-notes.md (Feature 1)
2. docs/competitive/apple-health/implementation-notes.md (Feature 1)
3. src/app/records/page.tsx (current implementation)
4. src/components/records/LabsTab.tsx

YOUR FILE OWNERSHIP:
- MODIFY src/app/records/page.tsx (from 4-tab to scrollable timeline
  with filter chips)
- CREATE src/components/records/TimelineEntry.tsx (polymorphic row:
  lab, imaging, appointment, timeline_event, active_problem)
- CREATE src/components/records/ProviderBadge.tsx (color-coded by
  specialty)
- CREATE src/components/records/FilterChipBar.tsx
- CREATE tests

DATA ACCESS (all READ-ONLY):
- lab_results, imaging_studies, appointments, medical_timeline,
  active_problems

CONSTRAINTS:
- Keep 4-tab URL routes working for back-compat (redirect to anchor)
- Use Recharts useRef width trick (NOT ResponsiveContainer, per
  CLAUDE.md rule 16)
- Warm modern tokens only

VERIFY + COMMIT per standard pattern.
```

---

## Subagent Brief D2 — Pre-Visit Doctor Prep Sheet

```
MISSION: Generate a pre-visit prep sheet per appointment. Ranks
changes-since-last-visit, outstanding tests, current meds, top
symptoms, and specialty-aware priorities.

READ FIRST:
1. docs/competitive/guava-health/implementation-notes.md (Feature 2)
2. src/app/doctor/page.tsx (existing /doctor, study structure)
3. src/lib/reports/doctor-report.ts (existing report generator)
4. src/lib/api/appointments.ts

YOUR FILE OWNERSHIP:
- CREATE src/app/doctor/pre-visit/[appointmentId]/page.tsx (dynamic
  route per appointment)
- CREATE src/lib/reports/pre-visit.ts (aggregation + ranking logic)
- CREATE src/components/doctor/PreVisitPrepSheet.tsx
- CREATE tests

SPECIALTY-AWARE PRIORITIZATION:
- OB/GYN: cycle stats, pain patterns, hormonal symptoms (use Wave 2a
  cycle engine output + headache_attacks cycle_phase join)
- Cardiology: Oura RHR/HRV trends, orthostatic data, BP readings
- Neurology: headache_attacks aggregate, MIDAS, HIT-6, cycle-migraine
  correlation (from Wave 2b B2 if shipped)
- PCP: whole-picture summary

CONSTRAINTS:
- Non-diagnostic framing per voice rule
- Cite data source for every claim
- Print-friendly layout (browser print dialog)

VERIFY + COMMIT per standard pattern.
```

---

## Subagent Brief D3 — Multi-Year Lab Trend Sparklines

```
MISSION: Replace static lab values with sparkline + reference-range
shading + patient-baseline delta badges. Critical for multi-year
pattern detection.

READ FIRST:
1. docs/competitive/guava-health/implementation-notes.md (Feature 3)
2. src/components/records/LabsTab.tsx
3. src/lib/api/labs.ts
4. CLAUDE.md (Recharts SSR rule: use explicit useRef width, NOT
   ResponsiveContainer)

YOUR FILE OWNERSHIP:
- CREATE src/components/records/LabSparkline.tsx (useRef-based
  Recharts)
- CREATE src/components/records/LabTrendRow.tsx (sparkline + value +
  badge)
- MODIFY src/components/records/LabsTab.tsx (replace static rows)
- CREATE tests

DATA ACCESS (READ-ONLY):
- lab_results (52 tests across Feb 2026)

CONSTRAINTS:
- Reference ranges from lab_results.ref_low/ref_high columns if
  present, else canonical ranges in a new src/lib/labs/ranges.ts
- Delta badge compares current vs 30-day, 90-day, 1-year rolling
  medians
- Warm modern tokens

VERIFY + COMMIT per standard pattern.
```

---

## Subagent Brief E3 — Micro-Care Drawer

```
MISSION: Build the 8-12 curated 30-second self-care actions drawer.
Chronic-illness-tuned: salt, hydrate, elevate legs, heat pad,
breathing exercise, 5-4-3-2-1 grounding, neck stretch, cold wrist.

READ FIRST:
1. docs/competitive/finch/implementation-notes.md (Feature 3)
2. docs/plans/2026-04-16-non-shaming-voice-rule.md
3. src/lib/migrations/021_micro_care_completions.sql (to be created
   by YOU in this brief)

YOUR FILE OWNERSHIP:
- CREATE src/lib/migrations/021_micro_care_completions.sql
- CREATE src/lib/migrations/run-021-micro-care.mjs
- CREATE src/lib/micro-care/actions.ts (the 8-12 action registry)
- CREATE src/lib/api/micro-care.ts
- CREATE src/components/log/MicroCareDrawer.tsx (bottom sheet)
- CREATE src/components/log/MicroCareAction.tsx (individual action
  card with optional breathing-exercise / grounding flow)
- CREATE src/components/log/BreathingExercise.tsx (if not already
  present — check src/components/log/ first)
- CREATE tests
- MODIFY src/app/log/page.tsx to mount the drawer entry point (if not
  contested)

ACTIONS (opinionated starter list, POTS + endo relevant):
1. Salt tablet (POTS) — "Take 500mg sodium"
2. Drink 500ml water (POTS + general)
3. Elevate legs for 5 min (POTS blood pooling)
4. Heat pad on pelvis (endo cramps)
5. Box breathing 4-4-4-4 (parasympathetic activation)
6. 5-4-3-2-1 grounding (anxiety + pain distraction)
7. Gentle neck stretch (tension headache)
8. Cold wrist on inner arm (hot flash + anxiety)
9. Compression sock check (POTS)
10. Legs-up-wall yoga pose (POTS + relaxation)

MIGRATION 021:
CREATE TABLE IF NOT EXISTS micro_care_completions (
  id uuid primary key default gen_random_uuid(),
  patient_id text not null default 'lanae',
  action_slug text not null,
  completed_at timestamptz not null default now(),
  duration_seconds int,
  felt_better boolean,
  notes text
);

CONSTRAINTS:
- Voice: "Quick action. 30 seconds." NOT "Complete this task"
- No streak tracking ever
- No goal-met language
- Non-shaming: "Back soon" on close, not "Task abandoned"

VERIFY + COMMIT per standard pattern.
```

---

## After Wave 2c

Wave 2d adds:
- D4 Cover-page-first clinical PDF + specialist toggles (CareClinic)
- D5 Condition-tagging for symptoms (CareClinic)
- D6 Care Card + QR share (CareClinic)
- F1 Year-in-Pixels view (Daylio)
- F4 Today vs Baseline morning card (Apple Health)

Wave 2e adds remaining Daylio + Clue features.
