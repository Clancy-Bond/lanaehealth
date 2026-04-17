# Headache Diary -- Implementation Plan

Ranked by `(impact * 2) / effort-score` per section 8 of design-decisions.md (S=1, M=2, L=4, XL=8).

---

## Ranked Features

| Rank | Feature | Source pattern | Lanae impact (1-5) | Effort (S/M/L/XL) | Depends on | Score | Notes |
|------|---------|----------------|----|-----|------|-----|-----|
| 1 | One-tap during-attack logging with auto-timer + minimal UI | Migraine Buddy #1 | 5 | M | New headache_attacks table | 5.0 | Flagship feature, unlocks other patterns |
| 2 | Menstrual migraine classifier (pure / related / non) with cycle-phase correlation | NONE (unique) #3 | 5 | M | headache_attacks + cycle_entries (RO) | 5.0 | Clinically diagnostic, zero competitors |
| 3 | HIT-6 + MIDAS validated clinical scales | Migraine Monitor #2 | 5 | S | Extension of clinical-scales.ts | 10.0 | Highest ratio, fastest to ship |
| 4 | Medication overuse headache (MOH) detection engine | Migraine Monitor #4 | 4 | M | headache_attacks + medication log | 4.0 | Critical rebound prevention |
| 5 | Aura tracking multi-category (visual, sensory, speech, motor) | Migraine Monitor #5 | 4 | S | headache_attacks.aura_symptoms JSONB | 8.0 | Low-cost clinical detail |
| 6 | Head-zone body map (frontal, temporal L/R, orbital L/R, occipital, vertex, C-spine) | Migraine Buddy #7 | 4 | M | AnatomicalBodyMap.tsx extension | 4.0 | Diagnostic value for cluster detection |
| 7 | Personalized trigger confidence (food, sleep, weather x headache) | N=1 #6 | 4 | M | Existing correlation engine | 4.0 | Extend, don't rebuild |
| 8 | Neurologist PDF export with HIT-6, attack log, triggers | MB/MM #10 | 4 | M | Doctor Mode extension | 4.0 | Reuse structured report infra |
| 9 | Pain quality multi-select with ICHD-3 phrasing | Migraine Buddy #8 | 3 | S | PainType enum extension | 6.0 | Already mostly implemented |
| 10 | Time-of-onset pattern detection (circadian clusters) | Migraine Buddy #9 | 3 | S | headache_attacks timestamp | 6.0 | Auto-compute from attack log |

---

## Top 3 for implementation

### 1. HIT-6 + MIDAS validated clinical scales (score 10.0)

Rank 3 by impact, but rank 1 by (impact*2)/effort = 10/1 = 10. Highest ratio wins per our ranking formula.

### 2. Aura tracking multi-category (score 8.0)

Low-cost field addition to headache_attacks table with high clinical value. 5 impact * 2 / 1 effort = wait, 4*2/1 = 8.

### 3. One-tap during-attack logging (score 5.0)

Flagship UX. 5*2/2 = 5.0. Requires the headache_attacks migration that many other features depend on, so it's a foundational build.

Note: Menstrual migraine classifier scores equal 5.0 (5*2/2). Tie-broken in favor of during-attack logging because the classifier DEPENDS on headache_attacks table existing. The attack logging feature creates that table, so it must go first.

---

## Sequencing

Phase A (Migration 013): create headache_attacks table.
Phase B (Shortest ship): HIT-6 + MIDAS in clinical-scales.ts. Can ship independently.
Phase C (Attack logging UX): during-attack logger at /log/headache/active.
Phase D (Aura detail): JSONB field + UI chips on the attack logger.
Phase E (Menstrual migraine classifier): intelligence module reading cycle_entries (RO) + headache_attacks.

Phases B, C, D ship under the top-3 brief. Phase E is flagged in implementation-notes.md as next-up but not top-3 per our ranking formula.

---

## Red flags raised during research

None that block. All top-3 features respect:
- Existing tables read-only
- New tables additive (headache_attacks is new, migration 013)
- No modifications to cycle_entries or pain_points
- Clinical scales pattern matches existing clinical-scales.ts
- No conflict with existing migrations (highest is 012_push_subscriptions)

---

## Table capacity check

Per design-decisions.md section 14: 10-table cap. We are proposing ONE new table (headache_attacks) for the top-3. Well within cap.
