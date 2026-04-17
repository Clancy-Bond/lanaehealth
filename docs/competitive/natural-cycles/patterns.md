# Natural Cycles -- UX and Algorithm Patterns

Last updated: Apr 2026
Observed behaviors and published algorithm details, ranked by Lanae impact (1-5 stars). NC is the ONLY FDA-cleared digital contraceptive (Class II, De Novo DEN170052, August 2018). Lanae's feedback: "for periods and cycles if we copy anything it should be Natural Cycles." This doc extracts every replicable detail.

Primary algorithm sources (cited inline):
- **Scherwitzl E, Lundberg O, Kopp Kallner H, Rowland K, Ruck A, Schellschmidt I, Scherwitzl R, Gemzell-Danielsson K. "Perfect-use and typical-use Pearl Index of a contraceptive mobile app." Contraception 2017 (PMC5669828).** Pearl Index 1.0 perfect / 6.9 typical per 100 woman-years. 22,785 users, 18,548 woman-years.
- **Berglund Scherwitzl E et al. "Identification and prediction of the fertile window using NaturalCycles." Eur J Contracept Reprod Health Care 2015 (PubMed 25592280).** 1,501 cycles, 317 women. Mean delay from LH+ to BBT-based ovulation estimate: 1.9 days. Luteal phase length variation: 1.25 days SD per user. False positive rate (non-fertile flagged fertile): 0.05%.
- **Berglund Scherwitzl et al. "Real-world menstrual cycle characteristics of more than 600,000 menstrual cycles." npj Digital Medicine 2019.** 612,613 ovulatory cycles, 124,648 users. Mean cycle length 29.3 days.
- **Favaro C et al. "Advantages of determining the fertile window with the individualised Natural Cycles algorithm over calendar-based methods." Eur J Contracept Reprod Health Care 2019 (PubMed 31738859).** Demonstrates NC detects day-of-ovulation variance that calendar methods miss.
- **FDA De Novo DEN170052, decision memo (August 2018).** Classifies NC as software-as-medical-device; characterizes the algorithm's safety considerations.
- **Natural Cycles customer help center** (help.naturalcycles.com), articles cited per pattern.

---

## 1. BBT biphasic shift detection with progesterone anchor

**What it is**
Published: "post-ovulation, progesterone warms the female body by up to 0.45 C" (FDA DEN170052 memo). NC watches for a sustained temperature rise from a follicular-phase baseline to a luteal-phase baseline. Once confirmed (typically three consecutive elevated readings), NC declares ovulation has happened and begins emitting Green Days in the luteal phase.

The 2015 paper reports a 1.9 day mean delay between a positive LH test and the temperature-based ovulation day estimate, confirming NC uses the classic "three elevated readings above a cover line" heuristic with statistical smoothing. The temperature threshold is not a fixed delta in C; it is relative to the user's own follicular baseline, with a cover line drawn 0.05 to 0.1 C above the highest follicular reading.

**Why it works**
Temperature is a physiological consequence of corpus luteum progesterone. It is the most reliable post-ovulation confirmation signal short of a blood progesterone draw. Using the user's own baseline (not a population average) makes the detector personalized from day one.

**Trade-offs**
- Confirms ovulation AFTER it happens. Useless for contraception in the fertile window itself (NC's fertile-window prediction is separate, described in pattern 2).
- Sick days, alcohol, sleep disruption, and crossing time zones all corrupt the signal.
- Oura skin-temperature trend differs from oral BBT; NC applies a transformation to convert Oura trend to an "absolute value" for the algorithm (NC help article, 2022).

**Adaptability to LanaeHealth**
We have 1,187 Oura days. Our own BBT shift detector should:
- Compute per-user follicular baseline from the current cycle's first 7 days of temperature.
- Draw a cover line 0.05 C above baseline max.
- Require three consecutive readings above the line for shift confirmation.
- Apply the Oura trend-to-absolute transform explicitly (and flag in UI that Oura is not the same as oral BBT).
- Never use a fixed 0.2 C rule; always user-relative.

**Lanae impact: 5/5**

---

## 2. Fertile window as a six-day window centered on predicted ovulation

**What it is**
Published in NC literature and confirmed via help docs: "The [fertile] window comprises six days, calculated by taking your ovulation day and the five days before." This accounts for sperm survival (3-5 days) and ovum viability (12-24 hours).

For users still being calibrated, the predicted ovulation day is computed from cycle history (mean + uncertainty). For users with confirmed BBT shift in prior cycles, the prediction narrows as luteal phase length stabilizes (SD ~1.25 days per user, Scherwitzl 2015).

**Why it works**
The six-day window is the medical consensus. Anchoring on predicted ovulation rather than calendar day handles cycle-length variation without sacrificing fertility awareness.

**Trade-offs**
- If ovulation is mispredicted early by >1-2 days, a green day in the true fertile window becomes a pregnancy risk. NC documents this as an 0.5 per 100 woman-year error rate.
- Requires 1-3 cycles of history to calibrate uncertainty.

**Adaptability to LanaeHealth**
We are not a contraceptive. We do not need to emit red/green days. But the six-day fertile window is still the right framing for:
- "Your ovulation is predicted for Apr 22 (+/- 2 days)."
- "You are likely in your fertile window for the next 5 days."
- A visualization showing the six-day window overlaid on the cycle timeline.

We should compute ovulation uncertainty per cycle (std dev of day-of-ovulation from BBT + LH across prior cycles) and display +/- range, not point estimate.

**Lanae impact: 5/5**

---

## 3. Individualized uncertainty buffer (red-day buffer scales with cycle irregularity)

**What it is**
NC help article: "The algorithm gives a buffer of Red Days before the predicted ovulation based on factors like sperm survival probabilities, your personal ovulation pattern, how regular your ovulation pattern is, and how much data has been collected from past cycles."

For regular-cycle users, the buffer is small (the six-day fertile window plus a minimal safety margin). For irregular-cycle users, the buffer expands substantially. NC defines irregular as "less than 21 days or more than 35 days and/or length varies greatly from one cycle to the next" (help article "What if I have irregular cycles").

**Published algorithm behavior** (Favaro 2019): individualized algorithm identifies day-of-ovulation variance that calendar methods miss. Per-user luteal phase SD of 1.25 days across 1,501 cycles (Scherwitzl 2015) means the follicular phase absorbs nearly all of the inter-cycle variance.

**Why it works**
Real cycle variance is concentrated in the follicular phase. Ovulation timing is the unknown. A buffer that scales with YOUR cycle's SD (not the population's) is Bayesian posterior-style reasoning: priors (population) yield to your data as it accumulates.

**Trade-offs**
- Feels punishing to irregular-cycle users (many red days, long "learning" periods).
- "If your cycle is very irregular, Natural Cycles may be less suitable for you" (NC official acknowledgment, help article).
- The uncertainty buffer is opaque to users.

**Adaptability to LanaeHealth**
Lanae IS the irregular-cycle case. We should:
- Compute cycle-length SD from the 1,490 days of nc_imported data.
- Show +/- uncertainty on period prediction ("Your period is likely between Apr 24 and Apr 29").
- Explicitly show when data is insufficient ("Insufficient cycle history to predict with confidence").
- Never hide uncertainty. This is where we differentiate.

**Lanae impact: 5/5**

---

## 4. Sick-day and disturbance flag exclusion

**What it is**
NC provides three exclusion flags per temperature entry:
- **Sick** (infection, fever, flu)
- **Slept differently** (<5 hours, woken repeatedly, travel, shift work)
- **Hungover** (alcohol the prior evening)

From NC help: "An excluded temperature is not taken into account by the algorithm when calculating your fertility status. It is always better to exclude a temperature than to add a temperature that you are not certain about."

Excluded readings are stored but not used for baseline, cover line, or shift detection.

**Why it works**
BBT is noise-prone. Infection adds 0.5 C of signal that looks identical to a luteal shift. Alcohol suppresses dream REM and depresses core temp. Short sleep inflates skin temp (for Oura users). Explicit user-marked exclusion keeps the algorithm clean without requiring ML to identify outliers automatically.

**Trade-offs**
- Users have to remember to tag exclusions.
- During a prolonged flare (Lanae's POTS/endo flares can last 5+ days), excluding every day in a row means the cycle effectively has no data.
- NC acknowledges that "if you have a medical condition such as PCOS, endometriosis, or hypothyroidism, you can still use the app. It may, however, take longer for the algorithm to get to know your cycle."

**Adaptability to LanaeHealth**
We already have symptom logs per day. We can AUTO-mark exclusion when:
- Lanae logs "fever" or temp >99.5 F on any symptom card
- Oura sleep score <50
- Lanae logs >2 alcoholic drinks the prior day
- POTS flare self-reported with intensity >=4/10 in the log

Manual override should still be available. Auto-exclusion turns NC's feature from "remember to flag" into ambient intelligence, a direct improvement.

**Lanae impact: 5/5**

---

## 5. Cover line visualization (educational graph)

**What it is**
NC shows a classic BBT chart with a horizontal dashed "cover line" drawn above the follicular average. Temperature dots below the line are follicular; three dots above the line confirm ovulation. The cover line changes per cycle as the baseline shifts.

**Why it works**
Visual proof of the algorithm's logic. Users see WHY today is a green day (dots are above the cover line for three consecutive days). This creates trust and literacy.

**Trade-offs**
- Requires Recharts or similar chart lib.
- Cover line can feel like false precision to first-time viewers; needs explanation.

**Adaptability to LanaeHealth**
We have Recharts. We have Oura temp trend data. A BBT chart with cover line is 1-2 days of work and produces a visually striking, educational graph. Already noted in cycle-tracking.md as an existing LanaeHealth edge ("Temperature biphasic shift detection (0.2C+ sustained for 3 days)").

**Lanae impact: 4/5**

---

## 6. Five-mode app (Birth Control, Plan Pregnancy, Follow Pregnancy, Postpartum, Perimenopause)

**What it is**
NC offers five distinct modes under one subscription (NC° Perimenopause launched Oct 2025). Each mode reconfigures the UI, predictions, and education content for a life stage. Perimenopause uses a separate "NC° Menopause Algorithm" that "analyzes cycle patterns, symptom shifts, and biometric data" and detects "early, mid, or late stage" perimenopause.

**Why it works**
One user, one app, across life stages. The data migrates with the user. Reduces abandonment during life transitions.

**Trade-offs**
- Feature surface is large. Risk of shallow coverage per mode.
- Perimenopause algorithm is newer and less peer-reviewed than birth-control algorithm.

**Adaptability to LanaeHealth**
Lanae is 24, not in perimenopause, not postpartum, not planning pregnancy. The "mode" abstraction is currently overkill. But the idea of a "cycle goal" setting ("understanding my cycle" vs "planning pregnancy" vs "managing symptoms") is worth a lightweight switch on the Patterns page, used to prioritize which insights to surface.

**Lanae impact: 2/5** (not her current life stage)

---

## 7. Cycle Report PDF for doctors

**What it is**
"A PDF document called the Cycle Report that you can export directly from the app to share with your healthcare provider, compiling data, including symptoms and other trackers, from your last six cycles" (NC help article).

Report contents (NC-advertised):
- Cycle length history (last 6 cycles)
- Period length and flow pattern
- Ovulation day per cycle
- Logged symptoms summary
- Temperature chart
- Any anomalies flagged by algorithm

**Why it works**
OB/GYN visits are short. Bringing a printout removes recall burden and surfaces patterns the patient hadn't noticed. High perceived value, low cost per report.

**Trade-offs**
- Not truly structured for clinical use (FHIR would be ideal, PDF is what exists).
- Requires a PDF generator.
- Six cycles is sometimes too short for long-term pattern recognition.

**Adaptability to LanaeHealth**
Lanae has OB/GYN Apr 30. We have `src/app/doctor/`. A "Cycle Report" tab that pulls from nc_imported is directly aligned. Already identified as top 3 for Flo. Natural Cycles reinforces the feature as industry standard.

**Lanae impact: 5/5** (time-sensitive: Apr 30 OB/GYN)

---

## 8. Passive wearable temperature (Oura, Apple Watch, NC Band)

**What it is**
NC integrates with three wearable devices for overnight temperature:
- **Oura Ring**: reads finger skin temperature trend, NC applies transformation to derive a single "NC absolute value" per night.
- **Apple Watch (Series 8+)**: wrist temperature during sleep, same transformation concept.
- **NC Band (launched 2025)**: proprietary armband designed explicitly for NC (for users without Oura).

Clinical claim: "Natural Cycles is 93% effective with typical use and 98% effective with perfect use when used with the Oura Ring, the same as if used with a basal thermometer" (NC research library).

**Why it works**
Biggest friction reducer in the category. No waking routine. Works for shift workers and new parents. Lanae already has Oura.

**Trade-offs**
- Skin temperature is not core temperature. Relative magnitude of the shift is preserved, but absolute value is not BBT.
- Ring fit, cold rooms, and bedding all add noise.
- Manual Oura sync complaints on Trustpilot (now resolved with API).

**Adaptability to LanaeHealth**
We have Oura API integration. We have 1,187 days of synced Oura data. Temp trend is available. We should expose a "Temperature source" setting (Oura, manual BBT, Apple Watch) and apply the appropriate transformation per source. Our edge: we can show BOTH temp and HRV on the same chart.

**Lanae impact: 5/5**

---

## 9. LH test integration (optional confirmation)

**What it is**
NC accepts optional daily LH ovulation tests. A positive LH test shifts the predicted ovulation to the test day +1 or +2 (LH surge precedes ovulation by ~24-36 hours, which NC uses as a strong prior that overrides temperature-only prediction).

Per the 2015 paper: "The mean delay from the first positive ovulation test to the temperature-based estimation of the ovulation day was 1.9 days." So LH+ triggers the fertile window prediction; BBT shift triggers the confirmation.

**Why it works**
LH surge is the single most specific biomarker of imminent ovulation. Pairing it with temperature gives both "impending" and "confirmed" signals.

**Trade-offs**
- LH tests cost money and require remembering to test.
- LH surge in women with PCOS is often sustained at a high-normal level, leading to false positives.
- Not all users test.

**Adaptability to LanaeHealth**
We already capture `lh_test` in nc_imported and cycle_entries. Surface it on the daily log with a "Positive" / "Negative" / "Not tested" toggle. When positive, shift our ovulation day prediction to test day + 1.

**Lanae impact: 4/5**

---

## 10. 1-3 cycle learning period with graceful early predictions

**What it is**
"It takes the algorithm 1-3 cycles to get to know your cycle. In the beginning, you will be given more generalized predictions. As you move forward in your cycles and log more data, your predictions will adapt accordingly and become increasingly personalized" (NC help article).

During the learning period, NC uses population priors (mean cycle length 29.3 days from their 600K+ cycle dataset) and shrinks the uncertainty buffer as the user's own data accumulates. Bayesian shrinkage in plain language.

**Why it works**
Honest about early limitations. Doesn't claim certainty it doesn't have.

**Trade-offs**
- First three months feel frustrating (many red days).
- Users who switch from hormonal contraception have suppressed cycles for months after stopping, extending the learning period.

**Adaptability to LanaeHealth**
We have 1,490 days of NC data already. Lanae is NOT in a learning period. But when we onboard our own detectors (fresh BBT from Oura without NC's pre-computed ovulation labels), we need to apply Bayesian shrinkage and show uncertainty honestly:
- Cycles 1-3: wider +/- ranges
- Cycles 4+: narrower based on her personal SD

**Lanae impact: 4/5**

---

## 11. Partner View (shared fertility status)

**What it is**
NC° Partner View shares user's daily fertility status (red/green), optionally including symptoms, mood, and full temperature graph. Partner gets their own app + Apple Watch complication. Configurable per user: how far back partner can see, which data fields are shared, Apple Watch display or not.

Notifications to partner (opt-in):
- First Green Day
- First Red Day
- Period or PMS approaching
- Time for ovulation test
- Self-breast exam reminder

**Why it works**
Top-loved feature across reviews (5 of our 30 "Loves" explicitly mention partner involvement). Distributes burden. Normalizes cycle-awareness in a relationship.

**Trade-offs**
- Heteronormative defaults ("your husband").
- Privacy concerns if partner relationship sours.

**Adaptability to LanaeHealth**
Clancy is the effective partner, already active in the app as admin. A lightweight "what Clancy sees" toggle for Lanae (on Profile) plus a shared daily summary surface would mirror the win without building a separate app.

**Lanae impact: 3/5** (already close to implemented; Clancy has access)

---

## 12. Data export (PDF Cycle Report + CSV Daily Entries)

**What it is**
Two export paths:
- **PDF Cycle Report**: as covered in pattern 7.
- **CSV Daily Entries**: email-gated download, two files within 24 hours, includes every logged data point per day including temperature, flow, LH, mood, symptoms, cycle phase, green/red status.

We used this export to populate nc_imported.

**Why it works**
Data portability signals trust. Users can leave if they want. Researchers can analyze. Supports "Right to Access" under GDPR.

**Trade-offs**
- CSV format is not standardized across femtech.
- 24-hour delay for CSV is annoying.

**Adaptability to LanaeHealth**
We should offer:
- "Export all cycle data as CSV" button on Settings.
- "Generate doctor report PDF" button on Patterns or Doctor page.
- Per-row source tagging (NC imported vs. manual entry vs. Oura).

**Lanae impact: 4/5**

---

## 13. Temperature fluctuation acknowledgment (user education)

**What it is**
NC has an entire help article titled "My temperature fluctuates, why, and what can I do about this?" that educates users on:
- Normal temperature variance (individual baseline can shift by 0.1-0.3 C between cycles)
- Sources of noise (infection, alcohol, sleep, time zone, stress)
- How to decide between logging and excluding

This is instructional UX rather than pure algorithm.

**Why it works**
Manages expectations. Prevents users from losing confidence when data looks messy.

**Trade-offs**
- Education hidden behind help docs; not in-flow.

**Adaptability to LanaeHealth**
Our in-flow tooltips and InsightBanner can surface phase-appropriate explanations ("Your temp is 0.3 C higher than yesterday. This often happens if you slept less than 6 hours, which you did last night per Oura. We are weighting today's reading lower.").

**Lanae impact: 4/5**

---

## 14. Cycle Insights tab (statistics view)

**What it is**
NC's statistics view shows:
- Average cycle length (with current cycle highlighted)
- Average period length
- Average luteal phase length
- Shortest and longest cycles in last 12 months
- Number of anovulatory cycles detected (if any)
- Temperature fluctuations across the cycle (superimposed)

**Why it works**
Summarizes months of data in a single scroll. "My cycles average 31 days, shortest 24, longest 42. Luteal phase 11-13 days. One anovulatory cycle in the last 12 months." This is exactly the shape of info an OB/GYN asks.

**Trade-offs**
- Some users find statistics overwhelming without context.

**Adaptability to LanaeHealth**
We have the raw data. A "Cycle Statistics" card on Patterns page would be a direct port. The anovulatory-cycle count is particularly valuable for Lanae given endo context.

**Lanae impact: 5/5**

---

## 15. Period prediction with forward-looking window

**What it is**
"How Natural Cycles predicts your next period" (help article): NC predicts next period start using prior cycle lengths weighted by recency, with the temperature-shift confirmed ovulation day as an anchor (period typically arrives luteal-phase-length days after ovulation). Displayed as a range, not a point.

**Why it works**
Users want a date to plan around. A range respects reality.

**Trade-offs**
- If Lanae's luteal phase varies (it can in endo), the range is wider.

**Adaptability to LanaeHealth**
We have this partially in cycle-calculator.ts (DEFAULT_CYCLE_LENGTH = 28). We should replace the fixed-default fallback with a personalized mean + SD, and display as a range not a single date. See implementation-notes.md.

**Lanae impact: 5/5**

---

## 16. Privacy posture: medical device grade

**What it is**
As a Class II FDA device and CE-marked medical product, NC is bound by MDR (EU) and FDA QSR. Data is encrypted at rest. NC publishes sub-processor lists. No ad targeting. Subject data subject requests supported via help desk with 30-day turnaround.

**Why it works**
Post-Dobbs US users worry about prosecution data. NC's medical-device framing is a moat competitors like Flo (which had a $56M class action settlement for sharing data with Facebook) cannot match.

**Trade-offs**
- Marketing emphasis on regulatory status can feel cold vs. Flo's warmth.
- Medical device status adds compliance cost.

**Adaptability to LanaeHealth**
We are single-patient on our own Supabase. RLS enforces isolation. No ad networks. Already ahead of most competitors. We can match NC's plain-language privacy copy ("We never sell data, never share with Meta/Google, never use your cycle data for ads.") on Profile/Settings.

**Lanae impact: 3/5** (already handled architecturally)

---

## Synthesis: Algorithm features to REPLICATE vs. IMPROVE

**Replicate verbatim** (published, well-validated, directly applicable to Lanae):
1. Per-user follicular baseline + cover line BBT shift detection
2. Six-day fertile window anchored on predicted ovulation
3. Individualized uncertainty buffer scaling with cycle-length SD
4. Sick-day / disturbance exclusion flags
5. LH test as strong prior on ovulation timing
6. Bayesian shrinkage during learning period
7. Cycle statistics view (mean, SD, shortest, longest, anovulatory count)

**Improve on NC for Lanae's case** (where NC fails or is suboptimal):
1. **Multi-signal fusion**: add HRV, RHR, sleep quality, manual cervical mucus to disambiguate when temperature alone is noisy. Lanae's POTS makes temperature signal noisier than average; HRV gives an independent cycle-phase signal.
2. **Auto-exclusion from symptom log**: if she logs fever, POTS flare, or <5hr sleep, auto-exclude temp instead of waiting for manual flag.
3. **Anovulatory cycle detection and education**: NC detects but doesn't heavily surface. For Lanae, anovulatory cycles are diagnostic (endo + thyroid context). Surface prominently.
4. **Short luteal phase alert**: Lanae's luteal phase can be <10 days. This is a clinically significant progesterone-deficiency marker. NC does not alert; we should.
5. **Endo-specific symptom tagging per cycle phase**: pain location, dyspareunia, GI symptoms. NC does not capture. We do.
6. **Cycle regularity scoring with honest uncertainty**: surface the current CV (coefficient of variation) of cycle length. "Your cycles have ranged 24-42 days over the last 12 months. Predictions have +/- 5 day uncertainty."
7. **No retroactive silent day-re-coloring**: if new data changes a past prediction, show the change explicitly with rationale.

**Skip for Lanae** (not applicable or diminishing returns):
1. Partner View app (Clancy already has admin access, no separate app needed)
2. NC Perimenopause mode (not age-relevant)
3. NC Postpartum mode (not relevant)
4. NC Band (Oura suffices)

---

## Top-ranked implementation targets for LanaeHealth (feeds into plan.md)

Ranked by (impact * 2) / effort:
1. **Multi-signal cycle intelligence engine** (BBT + Oura temp + HRV + RHR + LH + mucus with weighted confidence and transparent uncertainty) -- impact 5, effort M
2. **Cycle statistics + Cycle Report PDF for Apr 30 OB/GYN** -- impact 5, effort M
3. **Short luteal phase + anovulatory cycle detection and alert** -- impact 5, effort S
4. **Period prediction with +/- range (replace 28-day fallback)** -- impact 5, effort S
5. **Sick-day / disturbance auto-exclusion from symptom log** -- impact 4, effort S
6. **Cover line + BBT chart visualization** -- impact 4, effort M
7. **LH test "strong prior" integration on ovulation prediction** -- impact 4, effort S
8. **Bayesian shrinkage learning-period behavior** -- impact 4, effort S
9. **Phase-specific symptom correlation (NC is weak here)** -- impact 5, effort M (covered by Flo research, skip duplicative)
10. **Cycle Insights statistics view on Patterns page** -- impact 5, effort S
