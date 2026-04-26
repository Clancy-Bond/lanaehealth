# Oura Signals × Lanae's Conditions

Mapping of clinically relevant Oura Ring data points to Lanae's specific conditions (POTS, migraine, menstrual cycle complexity, possible endometriosis), with concrete UI surface recommendations grounded in the existing v2 codebase. Field names refer to the `OuraDaily` interface in `src/lib/types.ts`.

Available Oura fields per the schema: `sleep_score`, `sleep_duration`, `deep_sleep_min`, `rem_sleep_min`, `hrv_avg`, `hrv_max`, `resting_hr`, `body_temp_deviation` (deg C from baseline), `spo2_avg`, `stress_score`, `readiness_score`, `respiratory_rate`, `raw_json`.

---

## POTS (Postural Orthostatic Tachycardia Syndrome)

### Standard clinical monitoring
- Postural HR delta (sustained increase of at least 30 bpm within 10 minutes of standing for adults; without orthostatic hypotension) is the diagnostic anchor [NINDS, Dysautonomia International]
- Resting HR baseline trend (POTS patients often show elevated supine HR and instability)
- HRV trend (often blunted/low in POTS due to sympathetic overdrive and parasympathetic withdrawal) [Dysautonomia Expert]
- Sleep quality (poor in POTS; thermoregulation problems, restless legs, night sweats) [Dysautonomia Expert]
- Body temperature dysregulation
- Hydration / electrolyte status (clinical, not Oura-measurable)

### Oura signals applicable

| Oura field | Pattern / heuristic | Insight |
|---|---|---|
| `resting_hr` | 7-day rolling mean rising 5-10 bpm above 30-day baseline | Possible flare in progress or hydration loss |
| `hrv_avg` | Sudden drop (>20% below personal baseline) sustained 1-3 days | Strong correlate of upcoming or active flare per Emma N., Oura POTS spotlight (Feb 2025) |
| `readiness_score` | Drop into yellow / red zone | Cue to scale back; Emma N. uses this as her primary trigger |
| `sleep_score` + `deep_sleep_min` | Multi-night decline | Amplifies symptoms; sleep dip precedes flare |
| `body_temp_deviation` | Persistent off-baseline values | Autonomic thermoregulation marker |
| `stress_score` (daytime physiological stress) | Elevated daytime physiological stress | Sympathetic overdrive proxy |
| Symptom Radar (Oura's own composite, derived from raw_json) | Minor / major signs of strain | Oura's built-in composite of skin temp, RHR, HRV, respiratory rate, inactive time [Oura blog, Dec 2024] |

Oura cannot measure postural HR delta directly (it does not run a stand test). The diagnostic 30 bpm sit-to-stand criterion has to be captured manually or via a dedicated stand-test workflow if we want it in the app.

Important caveat: Oura explicitly states "Symptom Radar may not work optimally with pre-existing medical conditions" [Oura blog, Symptom Radar]. POTS itself shifts baselines, so derived insights must be presented as personalised trends, not Oura's stock interpretation.

### How to surface in app

- **POTS dashboard tile** in `src/app/v2/today/_components/` (new `TodayPOTSStatus.tsx`): combines RHR delta from baseline, HRV deviation, and Readiness drop into a single "stability" indicator. Color coded: stable / watch / flare-likely.
- **Flare-likely banner** on `src/app/v2/today/page.tsx` using the existing `Banner` primitive when 2+ of the three signals (RHR up, HRV down, sleep dip) cross thresholds.
- **POTS trend page** under a new `src/app/v2/patterns/pots/` route: 30-day overlay of RHR + HRV + Readiness, with menstrual cycle phase shaded behind (Emma's pattern of cycle-linked flares is explicit in the Oura member spotlight).
- **Manual stand-test logger** in `src/app/v2/log/` to capture sit-to-stand HR delta; surfaces in the patterns view for doctor visits.

---

## Migraine

### Standard prodrome detection
- HRV alteration in the 24-72 hours preceding attack (autonomic nervous system involvement is established in migraine pathophysiology) [PubMed PMID 41607086, 2026]
- Sleep quality / sleep regularity disruption
- Skin temperature shift (relevant especially for menstrual / hormonal migraines)
- Physiological stress elevation
- Resting HR elevation

### Oura signals applicable

| Oura field | Pattern / heuristic | Insight |
|---|---|---|
| `hrv_avg` | Nocturnal HRV deviation from personal baseline | Migraine-prediction studies show HRV during nocturnal sleep is a meaningful predictor; "significant individual variability" so per-person modeling is required [PubMed 41607086] |
| `body_temp_deviation` | Skin temp swing | Hormonally driven migraines often coincide with luteal-phase temp elevation |
| `sleep_score`, sleep regularity | Late bedtime, fragmented sleep, short duration | Common trigger; the Oura + Migraine Buddy partnership (Aptar, Jan 2026) explicitly fuses these signals with subjective logs |
| `stress_score` | Multi-day elevated physiological stress | Trigger correlate |
| `resting_hr` | Elevated trend | Trigger correlate |

Important caveat: research is still individualized - there is no validated population threshold ("X% HRV drop = 80% migraine risk in 24h"). The PubMed study explicitly says "significant individual variability." The Oura + Migraine Buddy clinical integration (Aptar partnership, Jan 2026) is currently the most public productization of this idea.

### How to surface in app

- **Migraine risk tile** on `src/app/v2/today/page.tsx`: shows "elevated", "watch", or "stable" based on HRV trend + sleep quality + temp deviation, layered over Lanae's logged migraine history. Use existing `MetricTile` primitive.
- **Trigger correlation chart** in a new `src/app/v2/patterns/migraine/` route: scatter of past migraine episodes (from `pain_points` or `daily_logs`) against Oura signals from the prior 24/48/72 hours, to surface Lanae's *personal* HRV-drop magnitude and lead time.
- **Prodrome alert** (pull notification or banner): only fire when Lanae's *own* learned threshold is breached, not a generic one. Bootstrap with a watch-only mode for the first 2-3 cycles to learn baseline.
- **Cycle-overlay**: any migraine risk view should overlay menstrual phase, since Oura specifically calls out the "hormonal blind spot" in migraine prediction.

---

## Menstrual cycle

### Standard tracking
- Basal body temperature (BBT) for ovulation detection
- HRV across cycle phases (HRV typically lower in luteal phase, recovers in follicular)
- Resting HR slightly elevated in luteal phase
- Sleep quality changes (luteal-phase sleep often more disrupted)
- Cycle length and regularity

### Oura signals applicable

| Oura field | Pattern | Insight |
|---|---|---|
| `body_temp_deviation` | Sustained shift of approx 0.3-0.7 deg C between follicular and luteal [Oura temp-tracking blog, citing PMC7575238] | Confirms ovulation; biphasic pattern is the gold-standard signal |
| `resting_hr` | Modest luteal elevation | Normal physiology, not pathology |
| `hrv_avg` | Lower in mid-to-late luteal | Normal physiology; needs cycle-aware Readiness algorithm to avoid false alarms |
| `readiness_score` | Oura now applies cycle-aware adjustment in luteal phase | Without this, luteal Readiness drops can be misread as illness or overtraining [Oura cycle-aware Readiness blog, Feb 2025] |

Validation: the PMC11829181 study (Thigpen et al., 2025) validated Oura's ovulation estimation algorithm specifically.

### Already shipped vs gap

- BBT for ovulation: shipped (per PR #58)
- Temp variation patterns: shipped (per PR #58)
- HRV across cycle phases: confirm in `src/app/v2/cycle/` and `src/app/v2/patterns/cycle/`. If not present as an explicit overlay, add it.
- Sleep quality cycle correlations: likely a gap. A "luteal-phase sleep" indicator on `src/app/v2/sleep/page.tsx` would close this.

### How to surface in app

- **HRV-by-cycle-phase chart** in `src/app/v2/patterns/cycle/`: line chart of `hrv_avg` averaged per cycle day, multi-cycle overlay.
- **Cycle-aware Readiness reframing** on `src/app/v2/today/_components/TodayCyclePhase.tsx`: when Oura's score drops in luteal phase, show "expected luteal-phase shift" vs "unusual drop" so users do not panic.

---

## Endometriosis

Lanae's status is "possibly endometriosis" - the app already exposes endo-mode in cycle log per the codebase audit. There is no large-cohort wearable + endo prediction study comparable to migraine HRV work. The closest validated evidence is the Mount Sinai IBD Forecast Study (Hirten et al., Gastroenterology, 2025) which showed wearables (Apple Watch, Fitbit, Oura) can predict inflammatory flares using circadian patterns of HRV, HR, RHR, and steps with AUC 0.98 up to 49 days before clinical flare [Gastroenterology Advisor summary]. Endometriosis is also an inflammatory condition, so the same physiological signature should plausibly apply, but this is extrapolation and must be flagged as such in any UI.

### Oura signals applicable (provisional)

| Oura field | Pattern (provisional, extrapolated from IBD evidence) | Insight |
|---|---|---|
| `hrv_avg` (circadian pattern) | Disrupted circadian HRV during inflammatory periods | IBD analog [Hirten et al., 2025] |
| `resting_hr` | Elevated during flare | IBD analog |
| `sleep_score` | Disrupted | Endo pain commonly disrupts sleep [Oura endo sleep blog] |
| `body_temp_deviation` | Possibly elevated during flare | Inflammation marker, weak evidence |

Endometriosis flares are best correlated with **logged pelvic pain** (already captured in `pain_points` per types.ts) cross-referenced with cycle phase.

### How to surface in app

- **Endo pain x cycle phase chart** in `src/app/v2/patterns/cycle/`: heatmap of pain intensity by cycle day across multiple cycles.
- **Flare-cluster indicator** combining HRV drop + RHR up + sleep drop on the days of logged pain: confirms the cluster is real, helps doctor conversations.
- Do *not* present an "endo flare prediction" without explicit research-grade caveat. Position it as "your body is showing inflammation-like signals" with a flare history overlay.

---

## Cross-condition signal fusion

The hard problem: when HRV drops or sleep dips, Lanae has at minimum four candidate causes:
1. POTS flare (autonomic)
2. Migraine prodrome
3. Luteal-phase normal physiology
4. Endo flare or other inflammation

### Disambiguation heuristics (rule-based, transparent, not ML)

| Signal cluster | Most likely interpretation |
|---|---|
| HRV drop + RHR up + cycle day 18-28 + temp elevated | Luteal physiology, possibly amplified PMS |
| HRV drop + RHR up + sustained 3+ days + outside luteal phase | POTS flare or inflammatory flare |
| HRV drop + sleep regularity disrupted + within last migraine's typical lead time | Migraine prodrome |
| HRV drop + logged pelvic pain | Endo flare candidate |
| HRV drop + multiple symptoms logged same day | Show all candidates with confidence proxy |

### How to surface in app

- **"Today, your body is signaling..." card** on `src/app/v2/today/page.tsx`: shows the top 1-2 candidate causes with the cluster of signals that justify each. Always display the *signals*, not just a verdict, so Lanae and her doctors can audit.
- **Why-this-alert drawer** using the existing `Sheet` primitive: tap an alert to see the underlying Oura signal deltas and recent cycle / symptom context that produced it.
- **Doctor-summary export** in `src/app/v2/doctor/`: append a "signal fusion log" of past 30 days showing which Oura cluster fired and which condition Lanae attributed it to (closing the feedback loop over months).

---

## Highest-impact features to ship for Lanae specifically

In order of expected clinical value relative to engineering cost:

1. **Cycle-overlaid HRV / RHR / Readiness chart** in `src/app/v2/patterns/cycle/`. Single most explanatory view; addresses POTS + migraine + cycle simultaneously. Emma N.'s POTS spotlight confirms this is the killer view for someone with cycle-linked autonomic symptoms.
2. **Personal HRV-drop migraine prodrome chart** in `src/app/v2/patterns/migraine/` (new). Show prior migraines plotted against HRV / temp / sleep deltas in the preceding 72 hours so Lanae's *own* threshold becomes visible.
3. **POTS flare composite tile** on `src/app/v2/today/page.tsx`: RHR + HRV + Readiness + (optionally) manual stand-test logger.
4. **Cycle-aware Readiness reframing** on Today / cycle pages: explain luteal-phase Readiness drops as expected so Lanae doesn't pre-emptively rest or panic.
5. **Today "your body is signaling" card** with transparent signal-cluster explanations (the disambiguation heuristic table above).
6. **Sleep regularity score** surfaced on `src/app/v2/sleep/page.tsx`: irregular sleep is a documented migraine and POTS amplifier; Oura tracks it but the app may not surface it.
7. **Pain-x-cycle heatmap** in `src/app/v2/patterns/cycle/` for endo pattern surfacing.
8. **Manual stand-test workflow** in `src/app/v2/log/`: captures the one POTS metric Oura cannot get (postural HR delta).
9. **Doctor-export pack** with last 90 days of Oura trends + flare clusters + pain log: directly serves the app's stated purpose.
10. **Symptom Radar passthrough**: just expose Oura's own Symptom Radar status (from `raw_json`) on the Today screen, with a clear caveat that POTS baselines reduce its accuracy.

---

## Sources

1. NINDS - Postural Tachycardia Syndrome (POTS): "heart rate may increase by more than 30 beats per minute or exceed 120 beats per minute within 10 minutes of standing." https://www.ninds.nih.gov/health-information/disorders/postural-tachycardia-syndrome-pots
2. Dysautonomia International - POTS diagnostic criteria. http://www.dysautonomiainternational.org/page.php?ID=30
3. Dysautonomia Expert - Heart Rate Variability and POTS: HRV as flare predictor, recovery from activity, mind-body intervention tracking; lists Oura among recommended wearables. https://dysautonomiaexpert.com/heart-rate-variability-and-pots/
4. Oura Blog - Member Spotlight: Navigating POTS With Oura Data (Emma N., Feb 2025). HRV and Readiness drops precede flares; cycle-linked flare pattern explicit. https://ouraring.com/blog/member-spotlight-navigating-pots/
5. Oura Blog - Symptom Radar (Dec 2024): composite of skin temperature, average temperature trends, respiratory rate, RHR, HRV, inactive time. Caveat about pre-existing conditions. https://ouraring.com/blog/symptom-radar/
6. PubMed PMID 41607086 - Heart rate variability as a predictor of migraine: nocturnal HRV via wearable + machine learning, n=23, "significant individual variability in physiological responses." https://pubmed.ncbi.nlm.nih.gov/41607086/
7. HIT Consultant - Aptar Digital Health x ŌURA partnership integrating Oura biometrics (sleep, HRV, temperature) into Migraine Buddy (Jan 2026). Explicit emphasis on hormonal-cycle layer. https://hitconsultant.net/2026/01/26/oura-migraine-buddy-integration-biometric-triggers/
8. Oura Blog - How to Use Oura Temperature Trends to Track Your Cycle: 0.3-0.7 deg C luteal-phase shift; cites PMC7575238. https://ouraring.com/blog/temperature-to-track-your-menstrual-cycle/
9. Oura Blog - Cycle-Aware Readiness (Feb 2025): luteal-phase HRV / RHR fluctuations now incorporated into Readiness algorithm. https://ouraring.com/blog/readiness-score-cycle-consideration/
10. PMC11829181 - Thigpen et al., 2025: validation of Oura Ring ovulation detection. https://pmc.ncbi.nlm.nih.gov/articles/PMC11829181/
11. Gastroenterology Advisor (Hirten et al., Gastroenterology 2025) - IBD Forecast Study (n=309, 16 used Oura): wearables differentiated inflammatory flares using circadian patterns of HRV, HR, RHR, steps; AUC 0.98 up to 49 days before flare. Strongest analog for endo flare prediction (extrapolation, not direct). https://www.gastroenterologyadvisor.com/news/wearable-devices-can-detect-physiological-changes-that-may-help-predict-ibd-flares/
12. Oura Blog - The Best Sleeping Position for Endometriosis: Oura's Nighttime Movement feature surfaces tossing-and-turning during endo symptoms. https://ouraring.com/blog/the-best-sleeping-position-for-endometriosis/

### Evidence-strength flags

- POTS + Oura: mostly community / member-spotlight evidence (Emma N. case study) plus Oura's general HRV / RHR / Readiness science. No randomized POTS-specific Oura trial. **Treat as plausible mechanism, surface as personal trends, not predictions.**
- Migraine + Oura: peer-reviewed prodrome research exists (PMID 41607086, plus older 39273725 and 29710791) and a productized clinical integration (Aptar / Migraine Buddy, 2026). **Best research base of all four conditions.**
- Cycle + Oura: strong, including Oura's own validation paper (PMC11829181) and biphasic-temperature physiology (PMC7575238). **Evidence-rich.**
- Endometriosis + Oura: no direct clinical trial. The IBD Forecast Study (Hirten 2025) is the closest analog. **Extrapolation, must be flagged as such in any user-facing copy.**
