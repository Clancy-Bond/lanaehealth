# Flo -- UX Patterns

Last updated: Apr 2026
Observed behaviors, ranked by Lanae impact (1-5 stars). Patterns that conflict with our rules (diet culture, fertility pressure, streak guilt) are called out and excluded from implementation candidates.

---

## 1. Phase-matched content layer

**What it is**
Every article, tip, and recipe in Flo is tagged with a cycle phase (menstrual, follicular, ovulatory, luteal). When the user opens the home tab, the content shown is filtered by where she is in her cycle today. Tips read like "your luteal phase may cause bloating, try magnesium."

**Why it works**
Cuts content overwhelm. Users already feel their cycle, so phase-matched content arrives at the moment of highest relevance. Feels personal without needing ML.

**Trade-offs**
Requires content to be phase-tagged at authoring time. Risks feeling patronizing if tips are generic. Can tip into pseudoscience (cycle-syncing diets) if editorial standards are loose.

**Adaptability to LanaeHealth**
Our Layer 2 summary engine already has reproductive category summaries. Tagging existing clinical summaries and Home-page InsightBanner entries by phase is low-cost. We should limit content to evidence-backed material only. No cycle-syncing diet claims.

**Lanae impact: 4/5**

---

## 2. Cycle-symptom correlation surfacing

**What it is**
After 2 to 3 logged cycles, Flo tells the user "your headaches cluster in the 3 days before your period" or "your mood dips during luteal." These are simple linear correlations computed across logged symptom data and predicted phase.

**Why it works**
Users rarely notice patterns themselves. Surfacing a correlation converts logging effort into felt value. Creates the aha moment that builds habit.

**Trade-offs**
False positives are harmful (telling someone "dairy causes your cramps" when it doesn't). Requires minimum data threshold and statistical guardrails. Must present with uncertainty language.

**Adaptability to LanaeHealth**
We already have `correlation_results` table with 8 significant patterns. We have cycle phase per day (from nc_imported and cycle_entries). Computing phase-banded symptom correlations is additive work on top of existing correlation engine. Lanae has 1,490 days of NC data plus daily_logs, more than enough.

**Lanae impact: 5/5**

---

## 3. Anonymous Mode (privacy pledge)

**What it is**
Users can create a Flo account with no email, name, or identifiers. Data stays local or is stored under a random UUID. Post-Dobbs feature added after abortion law changes in 2022.

**Why it works**
Addresses a real fear (cycle data used in prosecution or denial of care). The existence of the toggle signals trust even if the user doesn't use it.

**Trade-offs**
Losing account means losing data. Cloud sync becomes harder. If the user ever pays, the anonymous state may break.

**Adaptability to LanaeHealth**
We do not have anonymous mode. Lanae's use case is single-patient on Supabase with RLS. Pattern has limited direct value for her, but signals a privacy posture we should match in copy. Out of scope for implementation now.

**Lanae impact: 2/5** (Lanae is already the only user, her data never leaves our Supabase)

---

## 4. Cervical mucus with visual examples

**What it is**
When logging cervical mucus, Flo shows actual photos (dry, creamy, egg-white) alongside labels. Education embedded in the entry flow.

**Why it works**
Mucus is confusing. Most users guess. Visual calibration means the data is more reliable and the user learns.

**Trade-offs**
Imagery must be medical, not embarrassing. Needs licensing. Some users skip mucus entirely.

**Adaptability to LanaeHealth**
Our BBTRow component does not currently capture cervical mucus. Adding a simple mucus field to the cycle entry with text descriptions (licensed photos optional) is small effort. Lanae's NC data tracks this.

**Lanae impact: 3/5** (Lanae already logs via Natural Cycles)

---

## 5. Health Reports (doctor-ready summary)

**What it is**
One-tap generation of a PDF containing cycle length history, period length, symptom frequency, BBT chart, and phase-by-phase symptom distribution. Meant for OB/GYN appointments.

**Why it works**
Gynecologists ask "how long are your cycles, how heavy, any symptoms." Bringing a printout removes recall burden. High perceived value, low implementation cost.

**Trade-offs**
Free version shows only last 3 months; full report is Premium-gated in Flo. Patients report feeling nickel-and-dimed.

**Adaptability to LanaeHealth**
We have `src/app/doctor/` with existing visit-prep features. Adding a "Cycle Report" tab pulling from nc_imported and cycle_entries is straightforward. Lanae has OB/GYN Apr 30, this is time-sensitive.

**Lanae impact: 5/5**

---

## 6. AI Health Assistant (phase-aware)

**What it is**
In-app chat that answers questions like "why do I get headaches before my period." Grounded in cycle context (phase, recent symptoms, predicted next period).

**Why it works**
Users search Google for cycle questions and land on junk. A grounded AI with cycle context gives calibrated answers. Phase-awareness makes it feel bespoke.

**Trade-offs**
AI medical advice risk. Must refuse diet-culture and fertility-pressure prompts. Hallucination risk on clinical claims.

**Adaptability to LanaeHealth**
We already have `/chat` routed through context assembler. Adding current cycle phase to the dynamic context layer is one line. Lanae can already ask "why am I tired in luteal" via Chat, but the assistant may not consistently inject cycle phase. Low-cost improvement.

**Lanae impact: 4/5**

---

## 7. Partner Mode with cycle visibility

**What it is**
Invite partner via code. Partner sees phase, predicted period start, fertile window, and optional symptoms. No write access.

**Why it works**
Removes "why are you cranky" conversations. Partners feel included. Especially valued during TTC.

**Trade-offs**
Privacy concern: partner could weaponize PMS prediction. Flo has no visibility controls beyond all-or-none. Not appropriate if relationship has any abuse risk.

**Adaptability to LanaeHealth**
Not a current Lanae need (she does not have a paired partner use case described). Could be added later for others. Out of scope for this push.

**Lanae impact: 1/5**

---

## 8. Circular cycle wheel visualization

**What it is**
Home screen shows a circular donut with today's position on the cycle, color-coded by phase (menstrual red, follicular green, ovulatory yellow, luteal purple). Tap to see phase details.

**Why it works**
Cycles are circular. Bar charts fight the mental model. One glance answers "where am I."

**Trade-offs**
Assumes a predictable cycle. For very irregular cycles it misleads.

**Adaptability to LanaeHealth**
Our CycleCard already exists in `src/components/log/CycleCard.tsx`. Confirm whether it shows a wheel. If not, adding a phase wheel is medium effort and visually strong. Must handle uncertain phase with lighter colors.

**Lanae impact: 3/5**

---

## 9. BBT chart with temp shift annotation

**What it is**
Daily BBT points on a chart with an automatic line marking the sustained temp shift (ovulation). Crosshair lets user tap a day for detail.

**Why it works**
Shift is the single most important signal in BBT. Auto-annotation removes chart reading skill.

**Trade-offs**
Needs >=6 days of data per cycle. Handles erratic readings poorly.

**Adaptability to LanaeHealth**
We have Oura temperature in oura_daily (1,187 days) which is better than morning BBT. Auto-detecting the biphasic shift and overlaying on a Recharts line chart is additive work. Already called out in cycle-tracking.md as our edge.

**Lanae impact: 4/5**

---

## 10. Low-energy logging (symptom pills)

**What it is**
Tapping 1 to 5 pills (cramps, bloating, headache, mood) is sufficient for a day's log. No forced completion of all fields.

**Why it works**
Respects energy limits. People with chronic illness cannot fill 20 fields daily.

**Trade-offs**
Sparse data makes correlations noisier.

**Adaptability to LanaeHealth**
Our `SymptomPills.tsx` and `SymptomPillRow.tsx` already do this. Pattern validated.

**Lanae impact: 4/5** (already implemented)

---

## 11. Pregnancy mode switchover

**What it is**
When user logs a positive pregnancy test, app transitions to week-by-week pregnancy tracking with cycle history preserved.

**Why it works**
Keeps user in ecosystem through life transitions.

**Trade-offs**
Assumes pregnancy is a goal. Can feel tone-deaf after pregnancy loss (Flo has been criticized here).

**Adaptability to LanaeHealth**
Not a Lanae use case now. Defer.

**Lanae impact: 1/5**

---

## RED-FLAG PATTERNS (do not adopt)

### R1. Diet-culture content
Flo articles push "cycle-syncing diets" and intermittent fasting claims. Weak evidence, diet-culture framing. Hard exclude from our content layer.

### R2. Fertility-pressure nudges
Flo nudges users toward TTC mode even when they haven't opted in. Lanae is 24, not TTC. Never assume fertility goals.

### R3. Pregnancy test reminders on late period
Flo reminds users to take a pregnancy test when period is late. For users with known irregular cycles (endo, PCOS), this is distressing. Opt-in only, never triggered by absence.

### R4. "Your cycle may be irregular, see a doctor" loop
Repeatedly flagging known-irregular users is shame-adjacent and useless. Suppress once condition is known.

### R5. Premium paywalls inside the log flow
Every tap hits an upsell. Breaks trust. We do not monetize, this cannot happen to us, but it reinforces our anti-dark-pattern posture.

### R6. Retroactive data mutation
Flo silently changes past phase labels when the algorithm updates. Our rule: all analyses are deterministic from source data, and phase labels for past days never change after logged.

### R7. Ads in the logging flow
Tampon ads between symptom taps. Excluded. No ads ever.
