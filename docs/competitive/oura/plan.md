# Oura - Implementation Plan for LanaeHealth

Ranked using `(impact * 2) / effort-score` where S=1, M=2, L=4, XL=8. Top 3 are flagged.

All features read oura_daily as read-only. Any persistence uses additive migrations only. No re-sync needed, her 1,187 days are already on disk.

---

## Ranked Feature Table

| Rank | Feature | Source pattern | Lanae impact (1-5) | Effort (S/M/L/XL) | Depends on | Score | Notes |
|------|---------|----------------|--------------------|--------------------|------------|-------|-------|
| 1 | Readiness Contributor Waterfall + Morning Signal | Readiness Score breakdown + Symptom Radar | 5 | M | oura_daily read, new correlation_results rows | 5.0 | FLAGGED. Merges two top-rated patterns. Home-page morning nudge when contributors deviate. |
| 2 | Temperature Trend with Cycle Overlay + Illness Flag | Temp Trend Deviation | 5 | M | oura_daily.body_temp_deviation, nc_imported, cycle_entries | 5.0 | FLAGGED. Illness + cycle-dysregulation signal. Uniquely Oura data we are ignoring. |
| 3 | Adaptive Movement Suggestion (non-shaming) | Adaptive Activity Goal | 5 | S | oura_daily.readiness_score | 10.0 | FLAGGED. Single-file change, massive POTS-pacing impact, no new table. |
| 4 | Daytime Stress Time-in-Zones | Daytime Stress Classification | 5 | M | oura_daily.raw_json minute HR | 5.0 | Needs raw_json inspection. If minute HR not present, degrade to stress_score-based summary. |
| 5 | Recovery / Sleep / Readiness Triad | Three-score framing | 4 | S | oura_daily | 8.0 | Display-only change in SleepOverview or Home. |
| 6 | Tag-to-Biometric Impact Cards | Tags aggregation | 4 | M | daily_logs, symptoms, food_entries, oura_daily | 4.0 | Turns existing logging into insight. New analysis table. |
| 7 | Chronotype + Bedtime Sweet Zone | Chronotype / Bedtime Guidance | 4 | M | oura_daily sleep timestamps | 4.0 | Needs raw_json for bedtime/wake times. |
| 8 | Readiness Contributor Waterfall (standalone) | Readiness breakdown | 4 | S | oura_daily | 8.0 | Part of Feature 1 if we split, but lower impact alone. |
| 9 | Circadian Alignment Clock | Body Clock | 3 | M | oura_daily timestamps | 3.0 | Esoteric, defer. |
| 10 | Cardiovascular Stress Age | Cardio age (inverse use) | 3 | S | resting_hr, hrv_avg | 6.0 | Fun metric, lower clinical impact. |
| 11 | Workout Auto-Detect Surfacing | Workout detection | 3 | M | raw_json workouts | 3.0 | Only valuable if Lanae works out regularly. |

---

## Top 3 Flagged for Implementation

### 1. Readiness Contributor Waterfall + Morning Signal
Score 5.0. Merges patterns 1 and 11 from patterns.md. Displays today's readiness with 8 contributors showing deviation from Lanae's 30-day baseline. Triggers a gentle morning nudge when thresholds breach (readiness drop > 10, temp > +0.4C, HRV drop > 20%).

### 2. Temperature Trend with Cycle Overlay + Illness Flag  
Score 5.0. Uses body_temp_deviation column + cycle phase from nc_imported. Detects illness (sustained +0.5C for 2 consecutive days) and cycle-dysregulation (luteal temp rise that doesn't resolve at menstruation). Both are endo-relevant signals.

### 3. Adaptive Movement Suggestion
Score 10.0 (highest by formula). Single-file pattern that replaces any static "500 active cal / 10,000 steps" goal with a readiness-scaled suggestion. "Your body is asking for a gentle day" / "Moderate movement today" / "Full capacity available." No streaks, no completion %, no shame. Exactly the POTS-pacing intervention Lanae needs.
