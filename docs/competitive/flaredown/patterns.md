# Flaredown - UX Patterns

Patterns observed from Flaredown's app (iOS + Android) and the surrounding research blog, user-reported behavior, and community threads. Each pattern ranked by Lanae impact (1-5 stars).

---

## 1. Retrospective Trigger Surface ("What might be causing this?")

**Lanae impact: 5 stars**

**What it is**
When a user flags a bad day or flare, Flaredown surfaces factors from the preceding 24, 48, and 72 hour windows. It doesn't claim causation. It says "here's what changed in the 3 days before this flare." Layered list: weather changes, food eaten, stress flags, missed sleep, cycle phase, new medication.

**Why it works**
Cognitive load during a flare is near zero. The user doesn't have to remember or reason. The app does the lookup for them. It turns logging into payoff in the moment of worst pain, when motivation is highest to understand the cause.

**Trade-offs**
Risks false-pattern-attribution if user only sees one bad day. Requires discipline to not claim causation. Must show "context, not conclusion." Needs 2+ weeks of data to be meaningful.

**Adaptability to LanaeHealth**
Direct fit. We already have the data (oura_daily for sleep/HRV, food_entries, cycle_entries, daily_logs.triggers, medication data). Build a panel that activates when FlareToggle is toggled on: query last 72h of all factors, display as timeline cards. Do NOT claim causation, use language like "noticed in the 3 days before your flare" and link to correlation_results if an established pattern matches.

---

## 2. Barometric Pressure + Weather Auto-Enrichment

**Lanae impact: 5 stars**

**What it is**
Flaredown pulls local weather (temperature, humidity, barometric pressure) daily based on user zip code. User doesn't log weather. It's automatic, background, continuous. Overlaid on symptom charts. Time-lagged correlation: pressure changes 24-72 hours prior vs. current symptoms.

**Why it works**
Weather is the single biggest environmental trigger chronic illness users report, and it's completely invisible to manual logging. Automating it removes 100% of the friction. Barometric pressure drops precede storms and correlate with joint pain (arthritis, fibromyalgia), migraines, and POTS blood pooling.

**Trade-offs**
Requires a weather API (free tiers from Open-Meteo, WeatherAPI, NOAA). User must share location (zip code at minimum). Accuracy of correlation varies by individual.

**Adaptability to LanaeHealth**
HIGH fit for Lanae specifically. POTS is known to flare on low-pressure days (increased blood pooling). Endo users report similar weather sensitivity. Kailua HI has notable pressure swings before Kona weather systems. Add `weather_daily` table (new migration), cron-pull from Open-Meteo (free, no auth) using Lanae's zip, store pressure + humidity + temp per day. Feed into correlation engine as new factor_a candidate. Display overlay on Patterns page TrendChart.tsx.

---

## 3. Pre-Defined Trigger Library (100+ items)

**Lanae impact: 4 stars**

**What it is**
Flaredown ships with a curated library of 100+ known triggers organized by category: foods (gluten, dairy, FODMAP, nightshades, caffeine, alcohol), weather (pressure, humidity, heat, cold), stress (work, family, deadline), sleep (insomnia, short sleep, disrupted), meds (new rx, dose change, missed dose), activities (exercise overdid, long car ride, standing too long), environmental (pollen, smoke, mold). User taps to add from library rather than typing.

**Why it works**
Zero-config first-log. New users don't have to think about what to track. The library represents condition-specific knowledge. Categories speed scanning. Matches the user's vocabulary (not clinical jargon).

**Trade-offs**
Static libraries age poorly. Different conditions have different triggers. Must allow custom additions. Risks creating a "tax" where users feel obligated to track everything.

**Adaptability to LanaeHealth**
Partial fit. Our endo mode already has some of this. Expand to a `trigger_library` (seed-only, not user-writable) table with categories + condition-filtering (endo, POTS, fibro, IBS). Surface in CustomFactorsCard.tsx as preset chips users can tap. Our existing triggers field on daily_logs is a free-text string, which is OK but prevents aggregation. Consider a normalized `daily_log_triggers` join table long-term (out of scope for this plan).

---

## 4. Time-Lagged Correlation (lag_days)

**Lanae impact: 5 stars**

**What it is**
Flaredown computes correlation not just same-day (did eating gluten today cause pain today?) but across 1, 2, 3, and 7 day lags (did eating gluten 2 days ago cause pain today?). Lag correlations surface patterns invisible to same-day analysis. Example: "Alcohol 2 days ago predicts IBS flare today with r=0.52."

**Why it works**
Many chronic illness triggers have delayed effects. Inflammatory foods take 24-72h to manifest. Stress hormones cascade. Sleep debt compounds. Same-day correlation misses most of this.

**Trade-offs**
Requires substantial data (6+ weeks) to be statistically valid. Multiple comparisons problem worsens (must FDR-correct). Risk of spurious correlations at long lags.

**Adaptability to LanaeHealth**
DIRECT FIT. Our `correlation_results` table already has a `lag_days` column (INTEGER DEFAULT 0) that is likely underutilized. Our correlation engine runs Spearman + Mann-Whitney but I need to verify it computes at multiple lags. If not, extend the engine to iterate lag 0, 1, 2, 3, 7 and write separate rows per lag. Display lag in CorrelationCards.tsx (currently unclear if shown).

---

## 5. Treatment Effectiveness Scoring

**Lanae impact: 4 stars**

**What it is**
For each medication or treatment logged, Flaredown asks "did this help?" (before/after pain/symptom rating). Over time, it computes an effectiveness score per med. Surfaces in the meds tab: "Ibuprofen: avg pain reduction 2.3 points after 90 min. Tylenol: 0.8 points."

**Why it works**
Answers the question every chronic patient asks: "is this med actually working or is it placebo?" Data-driven, personal, actionable. Feeds doctor conversations ("this med isn't working for me, can we try X").

**Trade-offs**
Requires users to log both before-med and after-med pain. Small sample per med. Confounded by severity at time of dose (you take more meds on worse days, creating selection bias).

**Adaptability to LanaeHealth**
Good fit. We have medication-adherence data. Extend the log flow: when a PRN med is logged, show a pain rating at T0, then send a notification (or surface on next open) at T+90min asking for pain rating. Compute delta per med over time. Surface in MedTimeline.tsx or a new component. This dovetails with our "PRN frequency escalation" feature plan.

---

## 6. Multi-Condition Timeline Overlay

**Lanae impact: 4 stars**

**What it is**
Stacked timeline chart showing Crohn's flares + fibromyalgia flares + mood + sleep overlaid. User can toggle conditions. Co-occurrence visible at a glance. "My fibro flares in the 48h after my Crohn's flare" becomes instantly obvious.

**Why it works**
Most chronic illness patients have multiple comorbidities (Lanae has endo + POTS + chronic fatigue). Siloed tracking misses the interactions. Overlay reveals which conditions drive which.

**Trade-offs**
Chart complexity grows fast with 4+ conditions. Needs good filtering UX.

**Adaptability to LanaeHealth**
Fit. Our Timeline page exists. Extend it with a condition-layer toggle (pain, cycle phase, POTS events, GI flags) plotted on a shared time axis. Already partially present via our Patterns page. Could also go in MedTimeline.

---

## 7. Research Opt-In with Transparency

**Lanae impact: 2 stars**

**What it is**
Flaredown asks users to opt in to anonymized data contribution for chronic illness research. Publishes aggregate findings back to community ("Flaredown users with IBD report 23% more flares on low-pressure days"). Opt-out at any time.

**Why it works**
Makes daily logging feel purposeful beyond self. Community contribution psychology. Transparency builds trust.

**Trade-offs**
Requires IRB-level data handling. Legal complexity. User trust hinges on transparency about downstream uses. Flaredown's OneStudyTeam acquisition eroded this trust.

**Adaptability to LanaeHealth**
LOW for v1. Lanae is a single patient, no research pipeline. But worth logging for future "if we multi-tenant this" scenarios. Skip for now.

---

## 8. Quick-Log Pattern (5-minute daily)

**Lanae impact: 3 stars**

**What it is**
Morning or evening check-in that asks the same 5-8 questions daily: pain 0-10, energy 0-10, mood, GI, sleep quality. Single screen, one-tap sliders, done in 90 seconds. No deep logging unless user opts into "details."

**Why it works**
Consistency matters more than depth. A 90-second daily log has 10x the longitudinal value of a 15-minute deep log done twice a week.

**Trade-offs**
Can feel shallow. Misses nuance. Requires well-tuned defaults.

**Adaptability to LanaeHealth**
Already present. Our DailyLogClient.tsx + EveningCheckIn.tsx cover this. Pattern validated, not a new implementation item.

---

## Patterns we are ignoring

- **Streak systems / gamification**: Flaredown doesn't do this, good. Aligns with our no-guilt rule.
- **Social feed / share flares**: Not present, intentionally private.
- **Research opt-in**: Single-patient app, not relevant.
