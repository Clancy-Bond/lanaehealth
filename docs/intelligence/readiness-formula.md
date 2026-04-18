# LanaeHealth Morning Signal: Readiness Architecture

**Status:** v1 shipped 2026-04-17
**Owner:** `src/lib/intelligence/readiness-signal.ts`
**Rendered by:** `src/components/home/MorningSignalCard.tsx`

## The Core Principle (project-level)

Competitor mirrors on `~/competitor-research/` were captured so we
could **learn what to pull from competitors, add a LanaeHealth layer
on top, and rebrand — not rebuild from scratch.**

This principle applies across the product:

| Competitor | What we pull | What we add | Brand |
|------------|--------------|-------------|-------|
| Oura | Readiness score + 8 contributors + temp deviation | 7-day trend arrow per contributor, POTS-aware framing | "Morning Signal" |
| MyNetDiary | Food database, nutrients, verified badge | Cycle-aware nutrition coach, symptom-food correlations | "Nutrition" |
| Natural Cycles | Cycle predictions, fertile-window algorithm | Multi-signal (BBT + HRV + RHR) overlay, explainability | "Cycle" |
| Bearable | Tracking categories, PRN efficacy UX pattern | Condition-aware logging, clinical advisory engine | "Log" |

The first-pass mistake with Readiness was reinventing Oura's
weighted formula. **Oura's API returns all 8 contributors already,
each as a 0-100 score with their own proprietary weighting already
applied.** We render those directly. No competing calculation.

## What Oura gives us

The endpoint `/v2/usercollection/daily_readiness` returns:

```json
{
  "data": [{
    "day": "2026-04-17",
    "score": 78,
    "temperature_deviation": 0.1,
    "temperature_trend_deviation": 0.0,
    "contributors": {
      "activity_balance": 80,
      "body_temperature": 95,
      "hrv_balance": 70,
      "previous_day_activity": 75,
      "previous_night": 85,
      "recovery_index": 90,
      "resting_heart_rate": 80,
      "sleep_balance": 72
    }
  }]
}
```

The sync job at `src/app/api/oura/sync/route.ts` stores the full
response in `oura_daily.raw_json.oura.readiness`. We read it back in
the signal builder with no new network calls.

## What LanaeHealth adds on top

Three things, all of them trend/context, never replacement:

### 1. Trend arrow per contributor

For each Oura contributor, we compare today's sub-score to the user's
7-day median of that same contributor. If today is 5+ points above,
arrow up (sage). 5+ below, arrow down (blush). Within 5, flat (muted).

The 5-point threshold is chosen so normal day-to-day noise doesn't
clutter the UI. A 5-point sub-score shift on a 0-100 scale is
meaningful and corresponds roughly to a 0.5 SD move for a typical
user.

### 2. Non-diagnostic band labels

Oura's own UI says "Good / Fair / Pay Attention". LanaeHealth reframes
to match the non-shaming voice rule
(`docs/plans/2026-04-16-non-shaming-voice-rule.md`):

| Score | Oura's label | LanaeHealth label |
|-------|--------------|-------------------|
| 85+ | Optimal | Body ready for a full day |
| 70-84 | Good | Room to move, pace yourself |
| 55-69 | Fair | Body asking for a lighter day |
| 0-54 | Pay Attention | Save the heavy stuff |

### 3. POTS-aware context (v2 plan)

The Clinical Intelligence Engine already knows Lanae has POTS.
Post-MVP, the Morning Signal card will render a short context line
like "HRV balance down + orthostatic delta 15 bpm on Apr 7 suggests
pacing today." That's our original reasoning, layered on Oura's raw
numbers — not replacing them.

## Why we don't reinvent Oura's formula

This is important enough to state explicitly so we don't regress.
Reasons NOT to build a competing weighted readiness formula:

1. **Oura has millions of users worth of training data.** Our
   formula, however well-researched, can't match their calibration.
2. **Lanae uses the Oura app.** If our number disagrees with Oura's,
   she has to choose which to trust. That's a bad product experience.
3. **Oura updates their algorithm.** They just added menstrual-cycle
   awareness in 2024. A fixed weighted formula of ours would go stale.
4. **Our actual wedge isn't the score — it's the REASONING.** CIE
   telling Lanae WHY her readiness is 62 today (using her labs, her
   orthostatic history, her cycle phase) is the product. The score
   itself is table stakes.

## Score provenance

The card always labels the score as Oura's — never claims LanaeHealth
authorship. The `source` field on `ReadinessSignal` is one of:

- `'oura'` — Oura returned a score, we show it
- `'none'` — no Oura sync yet, card shows an empty state

There is no `'lanaehealth'` source. That field was removed when we
corrected course.

## Research context (historical)

Before the architecture correction, a competing formula was drafted
based on published literature (Whoop's 70/20/10 HRV/RHR/Sleep
weights, POTS dysautonomia markers from PubMed 36367272, sleep debt
non-linearity from PMC2892834, luteal BBT rise from PMC7575238).

That research is not wasted — it informs:

- How we pick which 4 of 8 contributors to surface first (HRV and RHR
  have the tightest clinical signal for POTS, so they're prioritized
  when deltas are similar)
- The CIE's POTS-aware reasoning that the v2 context line will use
- Which raw Oura metrics the Timeline and Patterns pages highlight

## Test coverage

See `src/lib/intelligence/__tests__/readiness-signal.test.ts`:

- Contributors pulled straight from `raw_json.oura.readiness.contributors`
- Score pulled straight from `oura_daily.readiness_score`
- Direction arrow uses 7-day median with a 5-point dead-zone
- Missing `raw_json` handled as empty state
- `buildReadinessSignal` never returns a computed score LanaeHealth
  authored

## References

- Oura API docs: [cloud.ouraring.com/v2/docs](https://cloud.ouraring.com/v2/docs)
- Oura Readiness Score overview: [ouraring.com/blog/readiness-score](https://ouraring.com/blog/readiness-score/)
- Oura Readiness Contributors: [support.ouraring.com](https://support.ouraring.com/hc/en-us/articles/360057791533-Readiness-Contributors)
