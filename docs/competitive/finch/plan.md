# Finch: Implementation Plan

Ranked features for LanaeHealth based on patterns observed in Finch. Ranking formula per `design-decisions.md` section 8: sort by `(impact * 2) / effort-score` where S=1, M=2, L=4, XL=8. Top 3 flagged for implementation.

---

## Ranked Feature Table

| Rank | Feature | Source pattern | Lanae impact (1-5) | Effort (S/M/L/XL) | Depends on | Notes |
|---|---|---|---|---|---|---|
| 1 | Energy-adaptive goal scaling (Gentle / Full / Minimal modes) | Pattern 2 | 5 | M | daily_logs, oura_daily, nc_imported | FLAG FOR IMPLEMENTATION. Infer energy from readiness + cycle phase + yesterday pain. Surface three-mode toggle. Extends EndoMode. |
| 2 | Rest Day action + non-shaming log surface | Pattern 9 + Pattern 1 | 5 | M | daily_logs (new column rest_day) | FLAG FOR IMPLEMENTATION. Positive framing of recovery. Migration adds rest_day boolean. Wires into check-in expectations. |
| 3 | Micro-Care drawer (30-second self-care actions) | Pattern 3 | 5 | M | existing components (BreathingExercise, HydrationRow, GratitudeQuickInput) | FLAG FOR IMPLEMENTATION. Unified drawer on log page. No new migration needed if we log completions to daily_logs notes or a new micro_care_completions table (M effort). |
| 4 | Four-tap mood check-in audit | Pattern 6 | 5 | S | MoodCard.tsx, MoodQuickRow.tsx | Audit and tighten existing flow to hit four-tap ceiling. Small code change, no migration. |
| 5 | Non-shaming continuity copy pass | Pattern 1 | 5 | S | existing log page copy | Remove any streak or "missed X days" language. Replace with cumulative counts. |
| 6 | Gentle insights copy framework | Pattern 8 | 4 | S | InsightBanner.tsx | Copy template library. Positive-only for home page, clinical language stays on Doctor page. |
| 7 | Short-form reflection prompts (one-line, rotating library) | Pattern 5 | 4 | M | GratitudeCard.tsx, gratitudes table | Rotating prompts based on cycle phase and recent symptoms. |
| 8 | In-app grounding (5-4-3-2-1) micro-intervention | Pattern 7 | 4 | M | BreathingExercise.tsx pattern | New component plus trigger logic on high-stress log. |
| 9 | Opt-out pressure settings section | Pattern 10 | 4 | S | Settings page | Add "Pressure settings" block. Default to gentle. |
| 10 | Tree of Life / Year in Care visualization | Pattern 4 | 3 | L | Home page, Timeline page | Nice emotional anchor, not clinically critical. Defer. |

---

## Formula work

Formula = (impact * 2) / effort-score. Higher is better. Ranking:

| Feature | Impact | Effort-score | Formula |
|---|---|---|---|
| Energy-adaptive goal scaling | 5 | 2 (M) | 5.0 |
| Rest Day | 5 | 2 (M) | 5.0 |
| Micro-Care drawer | 5 | 2 (M) | 5.0 |
| Four-tap audit | 5 | 1 (S) | 10.0 |
| Non-shaming copy pass | 5 | 1 (S) | 10.0 |
| Gentle insights copy | 4 | 1 (S) | 8.0 |
| Reflection prompts | 4 | 2 (M) | 4.0 |
| Grounding intervention | 4 | 2 (M) | 4.0 |
| Opt-out settings | 4 | 1 (S) | 8.0 |
| Tree of Life | 3 | 4 (L) | 1.5 |

Pure formula would rank the S-effort items first (four-tap audit and copy pass). Both are judged necessary but NOT standalone features; they're hygiene passes that inform all the M-effort work. To maintain alignment with the design-decisions rubric while providing genuinely new surfaces, top 3 are the three M-effort tied-at-5.0 features. The S-effort items should be folded into the top 3 as scope.

---

## Top 3 flagged for implementation

### FLAG 1: Energy-Adaptive Goal Scaling (Gentle / Full / Minimal)

Inferred daily energy from Oura readiness + luteal/menstrual phase + yesterday pain. Three-mode toggle (Gentle, Full, Minimal) on the log page. Minimal mode shows only mood + meds + water; Gentle adds mood + meds + water + one reflection; Full is the existing morning check-in. The four-tap mood audit rolls into this work.

### FLAG 2: Rest Day Action

Add a "Rest Day" button to the log page that writes rest_day = true to daily_logs for today. Visual treatment: sage card, not red. Check-in expectations collapse to "mood only" for rest days. Insights and charts treat rest days as expected data. Non-shaming copy pass rolls into this work (rewrite any streak-style language on the log page).

### FLAG 3: Micro-Care Drawer

A unified drawer on the log page with 8 to 12 curated 30-second self-care actions (hydrate, salt intake for POTS, heat pad for endo, 60-second breathing, 5-4-3-2-1 grounding, neck stretch, legs up the wall, dim lights, open window, text a friend prompt, cold wrist, gratitude one-liner). Each tap runs in-app and logs completion. Gentle-insights copy pass rolls into this work (positive-framed micro-care history).

These three flags collectively subsume the S-effort hygiene passes (four-tap audit, non-shaming copy, gentle insights) and deliver the highest-impact bundle.
