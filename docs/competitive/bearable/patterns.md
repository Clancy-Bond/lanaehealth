# Bearable UX Patterns Worth Stealing

One pattern per section. Each includes What it is / Why it works / Trade-offs / Adaptability to LanaeHealth. Ranked by Lanae impact (1-5 stars).

Patterns that conflict with Lanae's profile or design rules are flagged at the bottom, not ranked.

---

## Factor-to-symptom correlation engine with r-values

**Stars: 5/5**

**What it is**
A background process that computes correlations between every tracked factor (food, activity, supplement, stress, sleep, weather) and every tracked symptom. Surfaces results as human-readable statements with a correlation coefficient, e.g. "Stress correlates with headaches at r=0.65, based on 42 days of data." Confidence tiers labeled Suggestive / Likely / Strong.

**Why it works**
Converts messy longitudinal data into a single-sentence takeaway a patient can bring to a doctor. The r-value gives quantitative credibility without requiring the user to understand stats. Lag-aware correlation (day N food to day N+1 symptom) catches delayed triggers that same-day feel wrong.

**Trade-offs**
Requires 3+ weeks of reasonably consistent data before useful. Can surface spurious correlations if FDR correction not applied. Users with sparse logging get misleading patterns.

**Adaptability to LanaeHealth**
We already have `correlation_results` and a Spearman + Mann-Whitney + FDR-correction pipeline. What we need from Bearable's model is the surfacing: a dedicated insight card with plain-English statement, the r-value (or rho), sample size, and a lag badge (same-day vs 1-day vs 2-day vs 3+ day). Lanae impact is 5 because her POTS-endo-fatigue-cycle complexity screams for this. Use `var(--accent-sage)` for strong confidence, `var(--accent-blush)` for moderate, neutral text for suggestive.

---

## Non-shaming logging (no streaks, honored irregularity)

**Stars: 5/5**

**What it is**
No streak counter. No "you missed a day" nags. No guilt UI. Blank days are valid days. Past entries are always editable. Gentle reminders only if the user explicitly asks for them.

**Why it works**
Chronic illness patients inherently have variable days. A streak system punishes the worst days (flares) exactly when the patient least needs judgment. Retention data from chronic illness tracker users consistently shows streak mechanics drive 6-month dropoff, not long-term engagement.

**Trade-offs**
Removes a classic gamification lever for users who respond to streaks. But chronic illness is the wrong domain for that lever.

**Adaptability to LanaeHealth**
Audit our Log page and any notification copy for streak language. This is a do-not-introduce rule going forward. Lanae has POTS fatigue plus endo pain; flares are guaranteed. Impact 5.

---

## Blank-slate customizable tracker creation

**Stars: 4/5**

**What it is**
Users can create any trackable with any name, in any category (symptom / factor / activity / supplement / other), with their choice of input type (toggle, 0-5 scale, 0-10 scale, numeric, text). Each trackable gets its own icon, display order, and visibility.

**Why it works**
No preset ontology survives contact with chronic illness patients. Real patients track things that sound weird to ontology designers: "did I have to pee more than 5x today", "wore compression socks", "standing at sink caused dizziness at minute 3". The app that lets them add those is the app that gets daily use.

**Trade-offs**
Onboarding overwhelm. Real Bearable reviews say "90 minutes setup" or "quit 3 times before I stuck with it." Blank slate needs defaults.

**Adaptability to LanaeHealth**
We have custom_trackables table and a working CustomFactorsCard. Two upgrades to steal from Bearable: (1) Templates: on first use, suggest POTS, endo, thyroid, and sleep bundles of pre-filled trackables. (2) Grouping: add an optional parent category so a flat list of 30 trackables can collapse into sections. Lanae impact 4 because the table exists; improvement is additive, not foundational.

---

## Pill and supplement effectiveness rating, delayed-prompt

**Stars: 5/5**

**What it is**
When a user adds a medication or supplement, the app prompts them 2-4 weeks later with a short survey: "Is X helping? Rate 0-5." For PRN meds it prompts 2 hours after a logged dose: "Did X help?" The ratings are stored as a time series so you can see trend, not just a single snapshot.

**Why it works**
Self-reported "does this help" is noisy at the moment of taking it. Delayed or retrospective ratings produce better signal. Aggregating across 20+ takes gives doctors useful data.

**Trade-offs**
Delayed prompts need reliable notifications. On iOS without notifications permission, the feature collapses.

**Adaptability to LanaeHealth**
Perfect fit. Lanae is on multiple supplements (magnesium, iron, vitamin D, possibly more) and PRN medications. She has borderline TSH and high cholesterol, so if she starts interventions, we need efficacy tracking. Build a new `medication_effectiveness` table (or column set on medication_reminders) and a post-dose prompt flow. Lanae impact 5. Use `var(--accent-sage)` for rated-effective, neutral for unrated, `var(--accent-blush)` for rated-ineffective.

---

## Insight cards with plain-English narrative

**Stars: 5/5**

**What it is**
Instead of showing a chart and letting the user figure it out, Bearable surfaces findings as sentences: "Your pain is higher on days after less than 6 hours sleep (average 6.4 vs 4.2)." Each card has a drill-down to the underlying data but the headline is always prose.

**Why it works**
Chronic illness patients reading on a phone during a flare cannot parse a scatter plot. A sentence they can screenshot and text to their partner is a feature.

**Trade-offs**
Requires careful NLG (natural language generation) templates. Vague or overconfident sentences erode trust.

**Adaptability to LanaeHealth**
We have a Claude-powered context engine. Generating insight-card sentences from correlation_results is a 1-day feature. Add an `InsightCard` component to Patterns page, or elevate the best finding of the week to Home page. Always include confidence tier and sample size in small text. Impact 5 for Lanae, who prepares for doctor visits.

---

## Web + mobile data parity with shared backend

**Stars: 4/5**

**What it is**
Everything logged on phone shows instantly on the web dashboard. Charts that are too cramped on mobile get full-width treatment on web. Export and deep filtering are web-first. Daily logging is mobile-first.

**Why it works**
Chronic illness patients log on their phone when symptoms occur and review on a laptop when preparing for an appointment. Same app, different UI per surface.

**Trade-offs**
Requires responsive design discipline. Charts especially need separate mobile vs desktop layouts.

**Adaptability to LanaeHealth**
We are already Next.js web-first. Most of the work is ensuring the mobile experience at /log is as fast as Bearable's native app. Impact 4 because infrastructure is in place, just needs mobile polish.

---

## Quick-log drawer for flare days

**Stars: 5/5**

**What it is**
A single sheet where the user can check 10-20 common items in under 30 seconds. Designed for days when the patient is barely able to sit up. No cycle entry, no food detail, just "yes I'm in a flare, here are the top symptoms, I took X med."

**Why it works**
The worst days are when logging matters most and energy is lowest. If the app can't accommodate that, it loses the most valuable data points.

**Trade-offs**
The quick log and full log must stay in sync. Quick log can miss nuance the user wishes they'd captured later.

**Adaptability to LanaeHealth**
We have a `QuickLogSheet.tsx` and `FlareToggle.tsx`. Two upgrades: (1) When FlareToggle is on, auto-collapse all non-essential log sections. (2) Add "flare template" stored per-user so they configure what to show in crash mode once. Lanae impact 5 because POTS crashes and endo flare days are her reality.

---

## Chart stacking with synchronized time axis

**Stars: 4/5**

**What it is**
Multiple factors plotted vertically with shared x-axis. Pain on top, sleep middle, stress bottom, all aligned by date. Hover or tap one and all three highlight the same day.

**Why it works**
Visual correlation spotting. The eye catches patterns before stats do.

**Trade-offs**
Needs careful scaling. Different units on same axis can mislead.

**Adaptability to LanaeHealth**
Our TrendChart, CorrelationCards, and SleepOverview components exist. Stacking them with synchronized hover is a M-effort feature. Impact 4 because Patterns page gets stronger, but it's a view upgrade not a new capability.

---

## Color-coded severity with consistent scale

**Stars: 3/5**

**What it is**
Every tracked value gets color-coded using the same severity palette so pain 8/10 and stress 8/10 look similar across charts. Green / yellow / orange / red progression.

**Why it works**
Instant visual calibration. Users can scan a month of entries and feel the bad weeks.

**Trade-offs**
Red-green blind users need an alternative palette.

**Adaptability to LanaeHealth**
We have `--pain-none` through `--pain-extreme` CSS vars. Bearable pattern just validates ours. Ensure all severity displays use the existing palette vars, not raw colors. Impact 3 because we already largely do this; it's a consistency audit.

---

## Monthly summary card (opt-in, not intrusive)

**Stars: 3/5**

**What it is**
At month-end, a summary card appears showing: days logged, top 3 symptoms by frequency, top 3 factors that correlated with flares this month, best and worst weeks. User can dismiss or save.

**Why it works**
Reflection without homework. The card is the report; user doesn't have to generate anything.

**Trade-offs**
Stats need to be right. A wrong "best week" claim erodes trust.

**Adaptability to LanaeHealth**
New `MonthlySummaryCard` component on Home or Patterns. Feeds from correlation_results and daily_logs aggregates. Impact 3 because it's lower-value than delayed effectiveness or insight narrative but still a nice-to-have.

---

## Icon-first trackable identification

**Stars: 2/5**

**What it is**
Every trackable gets a small icon next to its name. Users scan by icon, not text, during rapid logging.

**Why it works**
Pattern recognition is 3x faster than reading for repeated items.

**Trade-offs**
Icons must be distinct. With 30+ trackables, you run out of obvious icons.

**Adaptability to LanaeHealth**
custom_trackables already has an `icon` column. We just need a pleasant icon picker in the Custom Factor creation flow. Impact 2 because it's polish.

---

## Export to CSV/PDF for doctor visits

**Stars: 3/5**

**What it is**
Tap export, choose date range, get a CSV or a formatted PDF with charts and a timeline. Email it or AirDrop it.

**Why it works**
Doctors don't use apps. Patients bring PDFs.

**Trade-offs**
CSV is raw. PDF with charts takes generation time.

**Adaptability to LanaeHealth**
We have Doctor Mode with structured reports. This is strictly stronger than Bearable's PDF export. Impact 3 on the export feature itself because we already exceed this; just verify Lanae can one-tap export for her April 30 OB/GYN, June 5 IM, Aug 17 Cardiology appointments.

---

## PRN post-dose efficacy polling

**Stars: 5/5**

**What it is**
When a user logs a PRN medication dose, the app schedules a notification for 90-120 minutes later: "Did your [med] help?" Two-tap rating. Data flows into the effectiveness time series.

**Why it works**
Captures efficacy signal at the moment it can still be remembered. Without prompting, users forget by evening whether the 10am pain med worked.

**Trade-offs**
Requires push notifications permission. Annoys users who don't want follow-ups.

**Adaptability to LanaeHealth**
Push notifications schema already exists (migration 012). Add an efficacy_prompt_log entry when PRN is logged, schedule a push 90 min later, capture the 2-tap response. Lanae impact 5 because PRN frequency escalation detection requires this data.

---

## Factor interaction warnings

**Stars: 2/5**

**What it is**
If you add a med that interacts with an existing one, pop a warning with severity and source.

**Why it works**
Catches clinically important interactions patients would otherwise miss.

**Trade-offs**
False positives erode trust. Requires a drug database.

**Adaptability to LanaeHealth**
We have medical-apis pipeline. But Bearable's implementation was widely criticized for being surface-level. Skip for now unless a real interaction risk surfaces for Lanae's meds. Impact 2.

---

## Voice-to-text entry (wish-list from reviewers)

**Stars: 3/5**

**What it is**
Tap mic, say "pain 7, stress 5, took ibuprofen," app parses and logs.

**Why it works**
Flare-day accessibility when hands shake or eyes can't focus.

**Trade-offs**
Parsing is fragile. User learns to speak in a specific grammar.

**Adaptability to LanaeHealth**
We have VoiceNote.tsx today for freeform notes. Structured voice parsing is a different, larger feature. Impact 3 for Lanae on flare days; E-level is M-L.

---

## Patterns flagged as NOT worth stealing

### Streak counters, daily-commit UI
Conflicts with Lanae's chronic illness reality. Explicit rule: do not introduce.

### Paywall gating of insights
We are paywall-free. Keep it that way.

### Apple-Watch-as-second-screen
Lanae uses Oura, not Apple Watch. Not a user need.

### Community pattern matching ("others with your condition flare when X")
We are single-patient. Not applicable.

### Flat symptom library
Bearable hates this themselves. We already have a `category` column on custom_trackables.

---

## Summary table: Pattern Stars Ranking

| Pattern | Stars |
|---|---|
| Factor-to-symptom correlation engine with r-values | 5 |
| Non-shaming logging (no streaks) | 5 |
| Pill/supplement effectiveness rating (delayed-prompt) | 5 |
| Insight cards with plain-English narrative | 5 |
| Quick-log drawer for flare days | 5 |
| PRN post-dose efficacy polling | 5 |
| Blank-slate customizable tracker creation | 4 |
| Web + mobile data parity | 4 |
| Chart stacking with synchronized time axis | 4 |
| Color-coded severity | 3 |
| Monthly summary card | 3 |
| Export CSV/PDF for doctor visits | 3 |
| Voice-to-text entry | 3 |
| Icon-first trackable identification | 2 |
| Factor interaction warnings | 2 |

Six 5-star patterns, three of which (correlation engine, effectiveness rating, insight narrative) converge into one top-3 implementation cluster. See plan.md for ranking and notes.
