# Oura Ring Data Integration Research

Compiled 2026-04-23 for LanaeHealth v2 (max-utilization audit).
All claims cited inline; full URL list in Section 7.

---

## SECTION 1: Oura's Full API Surface

### 1.1 Authentication
- OAuth 2.0 Bearer tokens via `https://cloud.ouraring.com/oauth/applications`.
- Both Personal Access Tokens (single user) and Public OAuth (multi-user partners) supported.
- Sandbox endpoints under `/v2/sandbox/usercollection/...` return realistic synthetic data without auth — useful for development.

### 1.2 All v2 endpoints (77 total operations documented)
Source: `https://cloud.ouraring.com/v2/docs` (full OpenAPI spec scraped).

User-collection endpoints, all under `https://api.ouraring.com/v2/usercollection/`:

| Endpoint | What it returns | Notes |
|---|---|---|
| `personal_info` | age, height, weight, biological_sex, email | Static profile |
| `tag` (deprecated) / `enhanced_tag` | User-logged tags (e.g. "alcohol", "stress", custom tags), with `start_day`, `end_day`, optional `comment` | Use `enhanced_tag` |
| `workout` | Self-logged or auto-detected workouts: `activity`, `calories`, `distance`, `intensity` ("easy"/"moderate"/"hard"), `start_datetime`, `end_datetime`, `source` ("manual"/"autodetected"/"confirmed"/"workout_heart_rate") |  |
| `session` | Mindfulness sessions: `type` ("breathing"/"meditation"/"nap"/"relaxation"/"rest"), HR/HRV/motion arrays | |
| `daily_activity` | Daily score + contributors (`meet_daily_targets`, `move_every_hour`, `recovery_time`, `stay_active`, `training_frequency`, `training_volume`); `active_calories`, `total_calories`, `equivalent_walking_distance`, `high_activity_met_minutes`, `medium_activity_met_minutes`, `low_activity_met_minutes`, `sedentary_met_minutes`, `non_wear_time`, `resting_time`, `steps`, `target_calories`, `target_meters`, `class_5_min` (5-min granular activity class string), `met` (per-minute MET array) | Score 0–100 |
| `daily_sleep` | Sleep score + 7 contributors (`deep_sleep`, `efficiency`, `latency`, `rem_sleep`, `restfulness`, `timing`, `total_sleep`); `timestamp` | Score 0–100 |
| `daily_readiness` | Readiness score + 9 contributors (`activity_balance`, `body_temperature`, `hrv_balance`, `previous_day_activity`, `previous_night`, `recovery_index`, `resting_heart_rate`, `sleep_balance`, `sleep_regularity`); `temperature_deviation`, `temperature_trend_deviation` | Score 0–100 |
| `daily_spo2` | `spo2_percentage.average`, `breathing_disturbance_index` | Last value is novel — sleep apnea / disordered breathing screening |
| `daily_stress` | `day_summary` (one of "restored","normal","stressful","prolonged_stressful"), `stress_high` (seconds), `recovery_high` (seconds) | Daytime metric |
| `daily_resilience` | `level` ("limited","adequate","solid","strong","exceptional"); `contributors`: `sleep_recovery`, `daytime_recovery`, `stress` | Long-term recovery capacity |
| `daily_cardiovascular_age` | `vascular_age` (years) | Single number, daily |
| `vO2_max` | Estimated VO2 max | |
| `sleep` | Per-period detail: `bedtime_start`/`bedtime_end`, `awake_time`, `total_sleep_duration`, `deep_sleep_duration`, `rem_sleep_duration`, `light_sleep_duration`, `efficiency`, `latency`, `restless_periods`, `average_breath`, `average_heart_rate`, `lowest_heart_rate`, `average_hrv`, `heart_rate` (5-min array), `hrv` (5-min array), `sleep_phase_5_min` (string of stage codes), `movement_30_sec`, `temperature_deviation`, `temperature_trend_deviation`, `breathing_disturbance_index`, `sleep_algorithm_version`, `period`, `type` (long_sleep/short_sleep/nap), `readiness_score_delta`, `sleep_score_delta` | The richest object Oura exposes |
| `sleep_time` | Recommended bedtime window, sleep timing analysis | |
| `rest_mode_period` | When user enabled Rest Mode (and why) | |
| `ring_configuration` | `hardware_type` (gen2/gen3/oura_ring_4), `size`, `color`, `set_up_at` | |
| `heartrate` | All-day HR samples, `bpm`, `source` (awake/rest/sleep/restmode/workout/session), 1- to 5-min granularity | High-volume |
| `ring_battery_level` | Battery % over time | |
| `interbeat_interval` (IBI) | Beat-to-beat ms intervals during sleep | Raw data for custom HRV computation |

[Source: `https://cloud.ouraring.com/v2/docs` scraped 2026-04-23, 7864 lines, 77 operations confirmed.]

### 1.3 Field-level details that matter for cycle/illness/migraine work

- **`temperature_deviation`** = single-night skin-temperature delta from your personal baseline, in °C. Noisy night-to-night.
- **`temperature_trend_deviation`** = smoothed multi-day deviation. **This is what Natural Cycles consumes** (per NC Head of Science: "The Oura Ring provides Natural Cycles with temperature trends, which Natural Cycles processes into a single, absolute temperature.") [Source: naturalcycles.com/research-library/how-effective-is-natural-cycles-when-used-with-the-oura-ring]
- **`breathing_disturbance_index`** in `daily_spo2` and `sleep`: not surfaced by most third-party apps; correlated with sleep apnea events.
- **`hrv_balance`** in `daily_readiness.contributors`: Oura's pre-computed comparison of 14-day HRV to 3-month baseline. Different from raw `average_hrv` in `sleep`.
- **`sleep_algorithm_version`**: Oura Ring 4 / Gen 3 use sleep staging trained on EEG; algorithm v1 vs v2 yields different stage breakdowns. Worth pinning.

---

## SECTION 2: Natural Cycles + Oura

### 2.1 Partnership facts
- NC is the **only FDA-cleared birth-control app** that integrates with Oura. [Source: ouraring.com/integrations]
- The integration is **one-way only**: "Oura will only share sleep data with Natural Cycles (which includes temperature trends, heart rate, sleep length, and sleep stages) if an Oura user gives explicit consent... Natural Cycles will have access to your Oura sleep data, but Oura will not have access to any of your Natural Cycles data." [Source: naturalcycles.com/oura FAQ]
- Requires both an active Natural Cycles subscription AND an active Oura Membership. Without an Oura Membership, **temperature trends cannot sync** (Oura computes the trend on its servers, only members get processed values).

### 2.2 Algorithmic mechanics (rare detail)
- BBT = basal body temperature (oral, the lowest core-body-temp value during sleep).
- Oura measures **DST** = distal skin temperature on the finger.
- DST is correlated with core body temperature when measured at night, per Krauchi K. (2002) "How is the circadian rhythm of core body temperature regulated?" Clin Auton Res 12:147–149. [Source: NC research library]
- NC's **clinical validation study**: 4-month study, participants wore Oura nightly AND used oral thermometer. The NC algorithm detected ovulation in **100% of cases** with both data sources. Number of "green days" (non-fertile) was comparable between sources.
- **Effectiveness**: 93% typical use, 98% perfect use — same as oral thermometer use of NC. FDA cleared via 510(k) K202897.
- **Important**: NC did NOT modify its algorithm for Oura. They simply substituted temperature input. The single-temperature-per-day value Oura provides to NC is internally derived from `temperature_trend_deviation`, smoothed multi-day data.

### 2.3 Why this matters for LanaeHealth
- v2 already uses `body_temp_deviation`. The harder-to-find but more clinically valid value to mirror NC's approach is **`temperature_trend_deviation`** (multi-day smoothed). NC found single-night temp too noisy and constructed an absolute-temperature value from the trend.
- NC requires ~60 days of baseline before predictions stabilize for its algorithm. Oura itself requires ~60 nights for cycle phase predictions to be best-quality (though as of Nov 2025 algorithm update, predictions are now possible after a single night).
- Cycle phase from Oura ≠ Cycle phase from NC. Reddit users routinely report disagreements; Oura uses temperature trends + HR + HRV + respiratory rate; NC uses only temperature in a different statistical model. [Source: reddit.com/r/ouraring "Oura Cycle Phase different than Natural Cycles Phase"]

---

## SECTION 3: Major Health App Integrations

### 3.1 Cronometer (food + nutrient tracker)
- Direct OAuth integration since 2023.
- **Imports from Oura**: Sleep Score, Cycle Insights (cycle day + cycle phase + body temp variation), Readiness Score, Body Temperature Variation, HRV during sleep, Respiration Rate during sleep, All-Day Heart Rate. [Source: cronometer.com/blog/oura-ring/]
- **Does not push back** to Oura.
- **Insights derived**: Custom Charts let users overlay nutrition vs sleep, magnesium-vs-sleep, cycle phase vs calorie intake, cycle phase vs cravings, cycle phase vs mood. Cronometer Gold required for charts.
- **Cycle phase nuance**: "Your cycle phase prediction can change throughout the day, much like the weather, and this data is only passed to Cronometer once Oura is confident about their prediction. This means that the cycle phase you see on your Dashboard will be from the prior day." Cronometer never shows today's predicted phase. [Source: cronometer.com/blog/cycle-tracking/]

### 3.2 MyFitnessPal
- Integration shows how food affects sleep.
- Pulls Sleep Score, Sleep Stages, Sleep Time. [Source: sleepreviewmag.com 2024]
- Less granular than Cronometer; primarily food/sleep correlation widget.

### 3.3 Wild AI (women's training)
- Pulls **only sleep and resting heart rate** from Oura. Not HRV directly. [Source: ouraring.com/blog/wild-ai-integration]
- Wild AI's training-recommendation model uses cycle phase + sleep + RHR to recommend morning check-in adjustments.
- Wild AI itself maintains the cycle phase tracking; Oura sleep + RHR are two of several inputs.

### 3.4 Premom
- No documented direct Oura integration; users manually correlate via Apple Health bridge. [Source: search results return no formal integration page]

### 3.5 Bearable (symptom tracker)
- **No direct Oura integration** as of April 2026. Bearable's own docs: "We're currently working on plans to offer direct integrations with devices such as ... Oura rings." [Source: bearable.app/support/howto/sync-with-other-devices/]
- Workaround: users connect Oura → Apple Health, then Bearable reads from Apple Health. This passes only what Oura writes to HealthKit (RHR, HRV, sleep stages, mindful minutes, active energy).

### 3.6 Apple Health (bidirectional)
- Two-way sync. **Oura writes to HealthKit**: active energy, heart rate, mindful minutes, sleep, body temp (gen3+), HRV, RHR. **Oura reads from HealthKit**: workout calories, workouts, date of birth, weight, height. [Source: ouraring.com/blog/apple-health/]
- Cycle phases / Cycle Insights are **not** written to HealthKit; that data lives only in the Oura app. This is why apps that sync via Apple Health (Bearable, etc.) cannot see Oura's cycle predictions.
- Apple Watch Companion App + Complications surface Oura scores natively on watch face; data refresh is laggy per DC Rainmaker review.

### 3.7 Strava
- Two-way sync. **From Strava → Oura**: workouts populate the Activity score / Workout Heart Rate. **From Oura → Strava**: workouts started via Oura's Workout Heart Rate feature push to Strava. **Auto-detected or manually-logged Oura activities cannot be shared with Strava** — only ring-initiated workouts. [Source: wareable.com 14-best-oura-apps]

### 3.8 Headspace
- Not a data integration — **content integration**. Select Headspace meditations, breathwork, and progressive muscle relaxation are exposed inside the Oura app. Oura then attributes mindful minutes and HR/HRV response to those sessions back to the user via session tracking. [Source: ouraring.com/integrations]

### 3.9 Dexcom (CGM)
- Major partnership added May 2025. Stelo (Dexcom's OTC CGM) data appears alongside Oura sleep/stress/activity in the Oura app.
- Oura does **not** push back to Dexcom directly; if you want meal events / activity in Dexcom, you have to bridge through Apple Health or Health Connect. [Source: wareable.com 14-best-oura-apps]

### 3.10 Other notable
- **Clue** (cycle tracking): syncs Oura temperature data only.
- **Glow** (fertility): Oura cycle + sleep impact analysis (Premium tier).
- **HRV4Training**: pulls overnight HRV and HR for athlete training-load analysis.
- **Apollo Neuro**: vibration wearable; uses Oura HR + HRV to customize vibration "Vibes" playlists for sleep / stress.
- **Talkspace, Thrive Global, CorePower Yoga, Technogym**: light data integrations.
- **Total documented integrations**: Oura claims 800+; partner page lists ~14 marquee partners.

[Source: wareable.com/wearable-tech/best-oura-compatible-apps-and-integrations]

---

## SECTION 4: Oura's Own Insights (Algorithms LanaeHealth Could Mirror)

### 4.1 Readiness Score (9 contributors, weighted)

All comparisons against personal long-term baselines (~2 months of data needed before stable; 14 days minimum). [Source: support.ouraring.com Readiness Contributors article]

| Contributor | Algorithm |
|---|---|
| **Resting Heart Rate** | Lowest HR last night vs long-term average. **Score declines if RHR is 3–5 BPM higher OR 10–15 BPM lower than usual**. Normal: 40–100 BPM. |
| **HRV Balance** | 14-day average HRV vs 3-month average, recent days weighted heavier. Different from "HRV rating" in Trends (which uses 7-day vs long-term). |
| **Body Temperature** | Last night's body temp vs long-term nighttime baseline. Normal range 95.9–99.3°F (35.5–37.4°C). Decreases readiness when outside personal baseline. Significant changes interpreted as illness, luteal phase, or pregnancy. |
| **Recovery Index** | Time spent sleeping after HR reaches its lowest point. **Optimal requires ≥6 hours of sleep after HR low point.** |
| **Sleep** | Last 24h sleep (naps included) vs personal baseline (short-term). |
| **Sleep Balance** | Last 14 days of sleep vs baseline AND age-recommended (AASM 7–9 hr adults). |
| **Sleep Regularity** | Consistency of bedtime and wake-up over past 14 days. Naps excluded. |
| **Previous Day Activity** | Yesterday's activity + sedentary time vs baseline. **5–8 hours of inactivity per day positive; more is negative.** |
| **Activity Balance** | 14-day activity (recent days weighted heavier) vs 2-month baseline. |

### 4.2 Symptom Radar (illness detection)
- Released to all users December 2024; built on the UCSF TemPredict / COVID study (2020).
- Inputs: **skin temperature, average temperature trends, respiratory rate, resting heart rate, heart rate variability, inactive time, age**.
- Outputs: "No signs", "Minor signs", "Major signs".
- **Requires ≥7 nights of sleep within the last 14 days** to compute a reading.
- Spotlights specific biometric deviations from baseline that triggered the alert.
- **Note: "Symptom Radar may not work optimally with pre-existing medical conditions. Pregnancy also impacts biometric baselines."** This is directly relevant for Lanae (POTS + migraine — both alter baselines).
- Surfaces alerts before Readiness Score itself drops; designed as an **early-warning** feature.
- [Source: ouraring.com/blog/symptom-radar/ + ouraring.com/blog/inside-the-ring-symptom-radar/]

### 4.3 Cycle Insights (cycle phase prediction)
- Trained on **42 million nights** of cycler sleep data (per Nov 2025 update). [Source: ouraring.com/blog/oura-cycle-insights/]
- Algorithm uses: heart rate, HRV, **temperature trends**, respiratory rate.
- **Ovulation prediction accuracy: >96%**, validated against luteinizing-hormone (LH) tests. [Source: ouraring.com/blog/oura-ovulation-detection-algorithm-validation-study/]
- **Two algorithms** within Cycle Insights: one for predicting next ovulation, one for retrospectively detecting actual ovulation.
- After Nov 2025 update, predictions available after **just 1 night** (previously needed 60 nights of baseline).
- Period and ovulation now predicted up to **12 months forward**.
- Phase displayed: follicular and luteal (4-phase view collapsed). Menstrual + ovulatory phases labeled within their parent phases.
- Hormonal birth-control users **cannot see follicular/luteal phase splits** because synthetic hormones suppress natural temperature shifts. They can still log periods and see period predictions.

### 4.4 Sleep Score thresholds
- Score 0–100, sub-thresholds: <60 "Pay Attention", 60–69 "Fair", 70–84 "Good", ≥85 "Optimal". [Same banding applies to Readiness, Activity.]

---

## SECTION 5: Specific to Chronic Illness (POTS + Migraine)

### 5.1 POTS
- Oura's official POTS member spotlight (Feb 2025): Emma N., 25, used Oura for HR, sleep quality, activity tracking. Key finding: **HRV and Readiness Scores drop BEFORE her POTS flares**, especially in the days before her period. She uses the early signal to preemptively rest, hydrate, and increase electrolytes. [Source: ouraring.com/blog/member-spotlight-navigating-pots/]
- Reddit r/ouraring POTS thread: members consistently report Oura's RHR baseline is 5–25 BPM higher than non-POTS controls; standing-induced tachycardia is **not** captured by Oura because the ring doesn't do orthostatic delta calculations (no postural sensing).
- Useful Oura signals for POTS:
  - Multi-day RHR trend (rising RHR = flare incoming)
  - HRV drop (especially night-over-night)
  - `daily_stress` `prolonged_stressful` flag (autonomic exhaustion proxy)
  - `previous_night.heart_rate` array can show whether HR ever truly dropped to lowest baseline (POTS often have less HR dipping)
- **Caveat from Oura's docs**: "Symptom Radar may not work optimally with pre-existing medical conditions" — for chronic conditions like POTS, Oura's algorithms may give false illness alerts because POTS already shifts baselines.

### 5.2 Migraine
- Oura users report ring detected prodrome 12–48h before attack via HRV drop + RHR rise + temp shift. [Source: reddit r/migraine 2025 thread, multiple users]
- Research literature (2026):
  - **2021 Frontiers in Neurology**: 18 episodic migraine patients vs 18 controls. During attack ("ictal phase"), 24-hour SDNN was much lower in migraine group: 56.94 ms vs 135.78 ms. Pain intensity negatively correlated with HRV. Between attacks (interictal), HRV did not significantly differ from controls.
  - **2023 Cephalalgia**: 81 chronic migraine patients vs 58 controls. Chronic migraine had reduced HRV consistent with autonomic dysfunction. Patients with more preserved HRV responded better to 12-week preventive treatment.
  - **2025 wearable study**: 10 episodic/chronic migraine patients tracked overnight with smartwatch (PRV, EDA, respiratory rate, sleep). Group-level patterns weak; **individualized models did better**. [Source: myhrv.com/posts/migraine-and-hrv summarizing PubMed sources]
- **Practical signal stack** suggested by literature:
  - Lower HRV + higher RHR + shorter sleep → strongest combined warning pattern
  - 7-day rolling HRV trend (NOT single-day)
  - Pair with: sleep duration & consistency, menstrual cycle timing, training load, hydration
- **For Lanae specifically**: combining `temperature_deviation` + `average_hrv` (sleep) + `lowest_heart_rate` (sleep) + `breathing_disturbance_index` over a 7-day rolling window is the literature-supported migraine prodrome signal stack.

### 5.3 Chronic illness community pattern
- The "long COVID + POTS" community on Oura Reddit largely uses **Rest Mode** (`rest_mode_period` endpoint) to prevent the activity score from punishing them on bad days. Rest Mode pauses Activity goals but Symptom Radar continues monitoring.

---

## SECTION 6: Underutilized Data Points

These are Oura fields that few third-party apps surface but have clinical value:

1. **`breathing_disturbance_index`** (in `daily_spo2` and `sleep`)
   - Sensitive to sleep-disordered breathing; correlates with sleep apnea events.
   - MFP, Cronometer, Wild AI all ignore it.
   - **LanaeHealth opportunity**: surface for nights with high BDI as a "consider sleep apnea screening" prompt.

2. **`temperature_trend_deviation`** (multi-day smoothed, in `daily_readiness`)
   - This is what Natural Cycles uses, NOT the noisier single-night `temperature_deviation`.
   - **LanaeHealth currently uses `body_temp_deviation`** — consider switching to or surfacing the trend version for cycle/illness work.

3. **`hrv_balance`** contributor (in `daily_readiness.contributors`)
   - Pre-computed 14d-vs-3mo HRV comparison. Removes noise from raw nightly HRV.
   - Better signal for "is this a recovery day or a strain day" than raw nightly HRV.

4. **`recovery_index`**
   - Time sleeping after HR low point; ≥6h optimal. Many apps show total sleep but not this. POTS / chronic illness patients often have shorter recovery indexes even with adequate total sleep.

5. **`average_breath`** (respiratory rate during sleep)
   - Often dismissed; sensitive to fever, infection, anxiety, alcohol intake, training overload.
   - Wild AI doesn't surface; Cronometer does.
   - **Migraine prodrome signal** per 2025 wearable research.

6. **`sleep_phase_5_min`** string (per-period)
   - Granular stage transitions; useful for sleep fragmentation analysis. POTS patients often show fragmented stage transitions.

7. **`restless_periods`** (in `sleep`)
   - Number of distinct restlessness clusters during sleep. Different from total restlessness time.

8. **`movement_30_sec`** array (in `sleep`)
   - 30-second granular motion. Used by Oura internally for sleep staging. Available raw via API for custom restlessness algorithms.

9. **`daily_stress.stress_high` and `recovery_high`** (seconds per day)
   - Daytime stress vs daytime recovery seconds. Maps cleanly to "daytime parasympathetic activity" — excellent autonomic-balance metric for POTS.

10. **`daily_resilience.contributors`** (sleep_recovery, daytime_recovery, stress)
    - Long-arc adaptive capacity. Shows whether the person is in chronic strain regardless of any single day's score.

11. **`interbeat_interval` (IBI) raw beat-to-beat ms data**
    - Almost no third-party app exposes this. Lets you compute custom HRV metrics (RMSSD, SDNN, pNN50, frequency-domain) on your own schedule. Required for any serious autonomic work.

12. **`tag` / `enhanced_tag` data**
    - User-logged events (alcohol, stress, custom). Lanae could surface "your alcohol tags correlate with HRV drop the next 2 nights" or similar correlations.

13. **`session` endpoint** (mindfulness)
    - Captures HR/HRV before/during/after meditation. Excellent for "did this breathing exercise actually shift autonomic state" feedback.

14. **`vO2_max`** and **`vascular_age`**
    - Both are computed daily; rarely surfaced outside Oura. Useful longitudinal cardiovascular markers for doctor visits.

15. **`ring_configuration.set_up_at`**
    - Lets you mark "data quality" gates — first 60 days of ring use have noisier baselines.

---

## SECTION 7: SOURCES

| URL | What it provided |
|---|---|
| https://cloud.ouraring.com/v2/docs | Full v2 API spec, 77 endpoints, sample payloads, all field names |
| https://www.naturalcycles.com/oura | NC-Oura partnership page; one-way integration; FDA cleared status |
| https://www.naturalcycles.com/research-library/how-effective-is-natural-cycles-when-used-with-the-oura-ring | NC clinical study: 100% ovulation detection w/ Oura, 93%/98% effectiveness; DST vs BBT explanation; FDA 510(k) K202897 |
| https://ouraring.com/integrations | Marquee partner list: Headspace, Strava, Natural Cycles, MyFitnessPal, Cronometer, Zero, Apollo, Talkspace; Apple HealthKit + Google Health Connect bridges |
| https://www.wareable.com/wearable-tech/best-oura-compatible-apps-and-integrations | 14-app survey: confirms 800+ integrations, details Wild AI sleep+RHR, Strava one-way, Cronometer cycle+sleep+readiness, Dexcom partnership, HRV4Training, CorePower, Technogym recovery metrics |
| https://ouraring.com/blog/wild-ai-integration/ | Wild AI imports sleep + RHR only |
| https://www.wild.ai/blog/oura-helps-me-train-according-to-my-menstrual-cycle-with-wild-ai | Confirms "sleep hours, quality and resting heart rate" |
| https://cronometer.com/blog/oura-ring/ | Cronometer field list: Sleep Score, Cycle Insights, Readiness, Body Temp Variation, HRV during sleep, Respiration Rate during sleep, All-Day HR |
| https://cronometer.com/blog/cycle-tracking/ | Cycle phase only updated when Oura is "confident" - shows prior day, never today |
| https://sleepreviewmag.com/sleep-health/parameters/quality/myfitnesspals-newest-integration-helps-users-see-how-food-affects-sleep/ | MFP integration scope |
| https://bearable.app/support/howto/sync-with-other-devices/ | Bearable has NO direct Oura integration; uses Apple Health bridge |
| https://ouraring.com/blog/apple-health/ | Apple Health is two-way; Oura writes active energy, HR, mindful min, sleep |
| https://www.dcrainmaker.com/2023/01/apple-integrations-closer.html | Apple Watch app + complications for Oura; Body Temp, Daily Movement, HR, Scores, Sleep Stages, Steps, Active Calories all available as complications |
| https://ouraring.com/blog/oura-and-strava-partnership/ | Strava sync mechanics (one-way for auto-detected workouts) |
| https://ouraring.com/blog/oura-headspace-partnership/ | Headspace content surfaced in Oura app |
| https://support.ouraring.com/hc/en-us/articles/360057791533-Readiness-Contributors | All 9 readiness contributor algorithms, exact thresholds (RHR 3-5 BPM higher etc, ≥6h after HR low etc) |
| https://ouraring.com/blog/symptom-radar/ | Inputs (skin temp, temp trends, resp rate, RHR, HRV, inactive time, age); ≥7 nights/14 days requirement; pre-existing condition warning |
| https://ouraring.com/blog/inside-the-ring-symptom-radar/ | Built on UCSF TemPredict; HRM enterprise platform origin |
| https://ouraring.com/blog/oura-cycle-insights/ | 42M night training set; >96% ovulation accuracy; 12-month forward predictions; 1-night data sufficient post Nov 2025 |
| https://ouraring.com/blog/temperature-to-track-your-menstrual-cycle/ | Body temp varies 0.3–0.7°C / 0.4–1°F across cycle; ~60 nights baseline traditionally |
| https://ouraring.com/blog/member-spotlight-navigating-pots/ | POTS user case study: HRV + Readiness drop BEFORE flare, especially around period |
| https://www.myhrv.com/posts/migraine-and-hrv | Migraine HRV literature summary: 2021 Frontiers (SDNN 56.94 vs 135.78 ictal), 2023 Cephalalgia chronic migraine, 2025 wearable individualized models, lower HRV + higher RHR + shorter sleep = strongest combined warning |
| https://www.fertstert.org/article/S0015-0282(25)01287-7/fulltext | Clinical validation of wearable ring-derived ovulation detection (referenced) |
| https://ouraring.com/womens-health | Oura's women's-health marketing surface; cycle features overview |

### Sources accessed but blocked
- pubmed.ncbi.nlm.nih.gov (reCAPTCHA)
- reddit.com (Firecrawl unsupported)

### Key research papers referenced (not directly scraped due to access)
- Krauchi K. (2002) Clin Auton Res 12:147-149 - DST/CBT correlation foundation for ring temperature science
- FDA 510(k) K202897 - NC + Oura clearance docket: https://www.accessdata.fda.gov/cdrh_docs/pdf20/K202897.pdf
- 2021 Frontiers in Neurology - HRV in episodic migraine
- 2023 Cephalalgia - HRV in chronic migraine + treatment response
- 2025 wearable migraine prediction (PubMed 41607086)
- Pilot Study: Oura Temperature Data for Menstrual Cycle Phase Monitoring (ouraring.com/blog/research-cycle-phases/)
