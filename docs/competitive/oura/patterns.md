# Oura - UX Patterns (Ranked for Lanae)

All patterns observed in the Oura Ring app (2024-2026). Ranked by direct impact on Lanae's chronic illness picture (POTS, suspected endo, cycle-linked symptoms). Patterns that rely on data we do not have in oura_daily are demoted or omitted. Where the pattern could be hybridized with data Lanae already has (cycle phase, NC, labs), we note the fusion.

Ranking key: 1 to 5 stars. 5 = directly addresses POTS/endo/fatigue/cycle. 4 = major daily-logging energy saver. 3 = general polish. 2 = nice to have. 1 = skip.

---

## Readiness Score with Contributor Breakdown (5 stars)

**What it is.** One daily score 1-100 (labeled "Pay attention" / "Good" / "Optimal") combining 8 sub-signals: resting HR, HRV balance, sleep balance, previous day activity, activity balance, body temperature, recovery index, sleep. Each contributor gets its own score and an icon (green check / amber triangle / red down arrow). Tapping the score opens the contributor list and tapping a contributor opens the chart.

**Why it works.** Three things at once: (1) single number for glanceability, (2) transparent breakdown so the user knows WHY, (3) no-shame language. The "Pay attention" label is clinical, not accusatory.

**Trade-offs.** Still opaque algorithm weights. Users cannot tell which contributor dragged the score. Oura does not publish the exact formula.

**Adaptability to LanaeHealth.** High. We have every input in oura_daily: readiness_score (already computed by Oura), resting_hr, hrv_avg, sleep_score, body_temp_deviation, stress_score, sleep_duration, deep_sleep_min, rem_sleep_min. We can display the readiness_score Oura already calculates, then build OUR OWN contributor waterfall showing which inputs deviated most from her 30-day baseline. This is additive display, not recomputation.

---

## Daytime Stress Classification (5 stars)

**What it is.** Four-state bar across the day: Stressed, Engaged, Relaxed, Restored. Based on continuous HR and HRV during waking hours. Each minute is classified. User sees the day as colored stripes and a pie chart ("You spent 32% of today Engaged, 18% Stressed, 28% Relaxed, 22% Restored").

**Why it works.** Discriminates helpful stress (Engaged = flow state) from harmful (Stressed = sustained sympathetic dominance). Most trackers lump all elevated HR as "bad." This is the opposite of "stress score."

**Trade-offs.** Requires continuous HR data, which we DO have in oura_daily's raw_json (Oura logs min-level HR). Need to verify column presence in our rows. If raw_json doesn't include minute-level HR we can only show daily stress_score aggregate.

**Adaptability to LanaeHealth.** Medium-high. For POTS, "time in sustained stressed state" is a direct dysautonomia metric. Standing with HR 120+ for hours would register as Stressed. If raw_json has detail we show the stripes. If it only has the aggregate we display a simpler "stress minutes" over the day.

---

## Temperature Trend Deviation (5 stars)

**What it is.** Continuous skin-temperature plotted as deviation from 90-day baseline, not absolute value. Shows a 7-day rolling band overlaid on cycle phase. Sharp upticks trigger illness alerts ("Your temperature is unusually elevated. Take it easy.").

**Why it works.** Deviation is personally calibrated, no one-size baseline. Cycle luteal rise shows up clearly. Illness onset creates a characteristic spike before the user feels symptoms.

**Trade-offs.** Medication changes (hormones, anti-inflammatories) can confound. Requires user awareness that temp alone isn't diagnostic.

**Adaptability to LanaeHealth.** Direct. body_temp_deviation column already populated. We have cycle data in nc_imported and cycle_entries. We can overlay phases and display illness alerts when deviation exceeds +0.5C for 2+ consecutive days. For endo suspicion, luteal-phase temp rises that DON'T fall at menstruation may signal hormonal dysregulation.

---

## Adaptive Activity Goal (5 stars)

**What it is.** Daily activity target adjusts based on readiness. If readiness is 55, goal drops from 500 to 250 active calories. The app explicitly says "Your body is asking for lighter movement today." No penalty, no streak-break. Low-readiness days count as rest.

**Why it works.** Validates the body's signal instead of shaming user into overdoing. This is the OPPOSITE of static step goals that guilt chronic illness patients.

**Trade-offs.** Some users feel infantilized by auto-scaling. Oura lets users override.

**Adaptability to LanaeHealth.** Very high. POTS pacing requires exactly this. We compute a daily "movement suggestion" from readiness_score: < 60 = gentle day (20 min light activity), 60-75 = moderate, > 75 = full capacity. Display as a soft suggestion in Home, never as a goal with completion %.

---

## Tags System (4 stars)

**What it is.** Tappable chips on each day: caffeine, alcohol, workout, menstruation, late meal, stressful day, travel, sick. Users tap tags after the fact or during the day. Oura then aggregates: "On days you tag alcohol, your deep sleep is 14 min lower on average."

**Why it works.** Super-low friction logging (no free text). Aggregations need 10+ occurrences before showing, preventing spurious patterns. Tags feed back into the correlation engine.

**Trade-offs.** Tag vocabulary is fixed. Users want custom tags (common complaint).

**Adaptability to LanaeHealth.** High. We already have daily_logs with symptoms, food_entries, and cycle data, which IS our tag system. What we're missing is the FEEDBACK LOOP: showing aggregated biometric impact per tag ("on days you logged pelvic pain, next-night deep sleep dropped 18 min"). This is implementable as a new correlation_results row type keyed on (tag, metric, direction, n, p-value).

---

## Recovery Index vs Sleep Score vs Readiness (4 stars)

**What it is.** Three distinct numbers: Sleep Score (how well you slept last night), Recovery Index (how deeply restored within sleep, measures HRV recovery during sleep), Readiness (how ready you are today). Users see these as three concentric rings.

**Why it works.** Good sleep does not equal recovery, recovery does not equal readiness. For POTS, you can sleep 9 hours AND get poor recovery AND still have low readiness because resting HR is elevated.

**Trade-offs.** Three numbers is more cognitive load. Many users just look at readiness.

**Adaptability to LanaeHealth.** High. We have readiness_score and sleep_score in oura_daily. Recovery is derivable as a combination of hrv_avg-during-sleep (from raw_json), resting_hr drop during sleep, and deep_sleep_min relative to her baseline. Display three numbers with the framing "Sleep quality / Nightly recovery / Today's capacity" so she can triangulate.

---

## Chronotype (4 stars)

**What it is.** Oura classifies user into one of 6 chronotypes (Early Morning / Morning / Late Morning / Evening / Late Evening / Night) based on 90 days of sleep timing. Updates quarterly. Pairs with Bedtime Guidance.

**Why it works.** Many people force schedules against their biology. Knowing chronotype reduces shame.

**Trade-offs.** Categorical chronotype can feel pigeonholing. Phase-shifts happen (pregnancy, illness, travel).

**Adaptability to LanaeHealth.** High. We compute chronotype by finding median bedtime and wake from oura_daily sleep_duration, combined with raw_json's start/end timestamps if present. Show her category and a 2-hour "biological sleep window" in SleepOverview.

---

## Bedtime Guidance (Sweet Zone) (4 stars)

**What it is.** Every evening, Oura suggests a 45-90 min window as "optimal bedtime". Personalized from chronotype + current sleep debt + upcoming wake time (if known). Called the "Sweet Zone".

**Why it works.** Specific time target, not a generic "sleep by 10pm". User sees a shaded window on a clock.

**Trade-offs.** Requires enough data to personalize, cold-start is generic.

**Adaptability to LanaeHealth.** Medium-high. With 1,187 days we have more than enough to compute her sweet zone. Display a tonight-specific bedtime window in evening check-in.

---

## Circadian Rhythm Alignment (3 stars)

**What it is.** "Body Clock" feature. Compares the user's actual sleep midpoint to their chronotype-ideal midpoint. Shows alignment as a clock face with two pointers.

**Why it works.** Misalignment ("social jetlag") correlates with metabolic and mood issues.

**Trade-offs.** Esoteric, most users ignore it.

**Adaptability to LanaeHealth.** Medium. Compute mid-sleep point from oura_daily, compare to her chronotype's ideal midpoint. Show as a simple "+1.5h off-alignment" indicator. Educational value for her endo/hormonal picture.

---

## Workout Auto-Detection (3 stars)

**What it is.** Oura detects activity bouts from HR profile and logs them automatically. User confirms or edits type.

**Why it works.** Reduces logging friction.

**Trade-offs.** Confuses housework for workouts. Misses low-HR workouts (yoga).

**Adaptability to LanaeHealth.** Low-medium. raw_json may include detected sessions. Low priority unless Lanae actively works out regularly.

---

## Cardiovascular Age (3 stars)

**What it is.** Cardio fitness translated into a "cardiovascular age" (e.g., "Your cardio age is 28" for a 34-year-old). Computed from VO2 max estimate.

**Why it works.** Aspirational framing. Easy for non-specialists to understand.

**Trade-offs.** VO2 max estimate is rough from a ring.

**Adaptability to LanaeHealth.** Low-medium for Lanae specifically, but could be reframed as "cardiovascular stress age" where her resting HR + HRV suggests an elevated autonomic age. Clinical signal for POTS.

---

## Morning Signal / Symptom Radar (5 stars)

**What it is.** Morning alert when readiness drops significantly vs baseline OR temp deviation is high OR HRV is down. User sees a gentle nudge ("Your body is showing early signs of strain. Consider an easy day.").

**Why it works.** Preemptive nudge catches flare-ups early. For POTS and chronic illness, catching flare onset before symptoms get bad is gold.

**Trade-offs.** Alert fatigue if thresholds too sensitive.

**Adaptability to LanaeHealth.** Very high. We compute alert conditions from oura_daily: readiness drop > 10 vs 7-day avg, OR temp deviation > +0.4C, OR HRV drop > 20%. Alert shown on Home in the morning, never as a push notification unless she opts in.

---

## Ranking Summary

1. Readiness Score + Contributor Breakdown (5 stars)
2. Morning Signal / Symptom Radar (5 stars)
3. Daytime Stress Classification (5 stars)
4. Temperature Trend Deviation with Cycle Overlay (5 stars)
5. Adaptive Activity Goal (5 stars)
6. Tags-to-Biometric Correlation Feedback (4 stars)
7. Recovery vs Sleep vs Readiness triad (4 stars)
8. Chronotype (4 stars)
9. Bedtime Sweet Zone (4 stars)
10. Circadian Rhythm Alignment (3 stars)
11. Cardiovascular Stress Age (3 stars)
12. Workout Auto-Detect (3 stars)
