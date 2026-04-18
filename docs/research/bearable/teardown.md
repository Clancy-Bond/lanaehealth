# Bearable Teardown → LanaeHealth Adaptation

Source: bearable.app + App Store listing (public marketing material).
Purpose: extract principles and patterns worth adapting. NOT a pixel-copy brief.
Date: 2026-04-17.

---

## TL;DR

Bearable is not more feature-rich than LanaeHealth. LanaeHealth already has:
AnatomicalBodyMap, HeadZoneMap, OrthostaticForm (tilt-table), ClinicalScaleCard,
BBTRow, PrnEffectivenessPoll, CyclePhaseTip, EnergyMode (Full/Endo/Flare) —
Bearable has none of these.

What Bearable is better at:
1. **Voice** — warm, chronic-illness-first, patient-centered, empathetic.
2. **Hero message clarity** — one outcome headline, one animated "proof" line.
3. **Entry-screen IA** — persistent date header, grouped accordions, count badges, severity chips.
4. **Correlation readout** — single card, factor-row per line, % impact + colored bar.
5. **Positioning copy** — how they explain *why* tracking beats notes/journal.

This doc extracts those patterns as principles, not pixel recipes.

---

## 1. Voice & messaging patterns

### Hero structure
- **Outcome headline (H1 behavior):** "Feel more in control of your health"
  - Not a feature. Not a description. The outcome the user wants.
- **Category label (eyebrow):** "Symptom & Mood Tracker App"
  - Tiny, above the H1 — orients SEO and newcomers.
- **Subheadline (one sentence):** "Quick and easy symptom tracking for any chronic health issue or disorder. Discover what improves and worsens your symptoms so that you can find better ways to manage your health and well-being."
  - Three beats: what it is → what it does → why it matters.
- **Social proof tucked in the corner:** "⭐ 4.7 App Store · ⭐ 4.6 Play Store"
  - Small, above the headline. Trust before claim.

### The "Discover how X affects Y" pattern
Their animated hero: `Discover how {Caffeine / Breath work / Meditation / Alcohol / Journaling / Bedtime / Social media / Work / Socialising / Pacing / Therapy} affects your {Sleep / Anxiety / Stress / Mood / Migraines / Focus / Fatigue / Pain / Well being}`.
- Teaches the value prop (correlations) by example.
- Gives 11×9 = 99 implicit use cases without writing them.
- **Adapt for LanaeHealth:** rotate pairs relevant to Lanae specifically:
  `Salt intake → Orthostatic delta`, `Cycle phase → Migraines`, `Sleep efficiency → Fatigue`, `Iron intake → Energy`, `Luteal phase → Pain flare`.

### Value-prop trio (on home page)
Three cards, emoji-headed:
- 💡 **Discover what's affecting your health** — correlations (cause + effect)
- ✅ **Simple & Customisable** — low friction + personal fit
- 🚀 **Everything in one App** — consolidation
- **Adapt for LanaeHealth:** (a) Ask your body and get a real answer / (b) Log in 30 seconds, even on flare days / (c) Every test, symptom, meal, and doctor note in one place.

### Trust stack (above the fold, subtle)
- Scientific review (Cedars Sinai evaluation)
- Professional endorsement (named clinicians)
- Patient-made (founder story — "built by someone with chronic migraines")
- Press mentions as a thin strip: Cedars Sinai / PsychCentral / US Pain Foundation / Verywell Mind / WebMD / Forbes.
- **Adapt:** replace with what's honest for LanaeHealth. Currently there's no press — so lean on: "Built for a real patient. Shared with her doctors. Not a demo."

### FAQ voice is conversational, not legal
Their "Can't I use my notes app?" answer is three paragraphs, empathetic, and
ends with "Bearable is easier to use and provides more insight than traditional
journaling or note taking and this is especially important for people that already
live with pain, exhaustion and overwhelm."
- **Principle:** answer FAQ questions like you're writing to a tired patient, not an SEO audit.
- **Adapt:** write LanaeHealth FAQ with Lanae's reality in mind ("Why should I track this? I already feel terrible.").

### Privacy framing
- "We'll never sell your data"
- UK-based → "not required to comply with US criminal subpoenas"
- Encryption + user-controlled export/delete
- Pin-code for app access
- **Adapt:** LanaeHealth is single-patient. Frame privacy as "Your data stays with you and the people you choose to show it to." Skip the big-co paranoia, keep it warm.

---

## 2. App Store listing patterns (public marketing)

Subtitle: **"Mood, Health, Migraine, Period"** — comma-listed conditions as SEO.
Screenshots (headlines on each):
1. Social proof caption ("Transformed my life with a chronic illness.")
2. Feature breadth ("Track Mood, Symptoms + more")
3. Value prop ("Find what triggers and what helps")
4. Speed promise ("Health entries in seconds")

Screenshot design pattern:
- Large headline top-center (fits in under 6 words)
- App mockup centered below
- Cool blue → white gradient background
- One highlighted word in accent color per headline (their red/pink)

**Adapt for LanaeHealth App Store / marketing page:**
1. "Built for a real patient with POTS, endo, and everything in between."
2. "Track symptoms, meds, labs, and Oura in one place."
3. "Find what's actually making you flare."
4. "Log the hard stuff in 20 seconds."

---

## 3. Entry-screen IA (what they do well on the logging screen)

From the three phone mockups on the homepage:

### A. Persistent date header
- "📅 Today, 11 May" at top of every entry screen.
- Tappable to change date.
- The words "Today" carries emotional weight — it's a low-stakes "what happened today" prompt.
- **LanaeHealth audit:** check that LogCarousel and the check-in screens all share a consistent "Today" header.

### B. Count badges per section
- "Mood 3.5", "Symptom score 6", "Factors 5", "Sleep 7h 30", "Meds/Supplements 2", "Food diary" (count shown inline).
- At-a-glance: "I've logged X things in this category."
- **Adapt:** LanaeHealth has MoodCard, CoreVitalsCard, etc. Add a count/summary number to each card header so the carousel self-reports "I've captured this much."

### C. Grouped accordions (MENTAL / PHYSICAL)
- Inside the Symptoms card: "MENTAL" header → Stress, Anxiety / "PHYSICAL" header → Headache, Fatigue.
- Each symptom row has a severity pill (Mild/Moderate/Severe) + timestamp.
- **Adapt:** LanaeHealth's SymptomPills could group by system (Cardiovascular / GI / Reproductive / Neurological) matching the Clinical Intelligence Engine's taxonomy.

### D. Severity pill pattern
- Three pills: Mild (teal) / Moderate (pink) / Severe (red).
- Currently-selected pill is filled; others are outlined.
- One tap = one entry.
- **Adapt:** LanaeHealth has PainSlider (0-10) + severity badges. Consider offering a 3-tap-pill mode in addition to the slider for fast entry (LiteLogCard may already do this — verify).

### E. Morning / Evening split
- AM and PM severity shown side-by-side ("12:22" and "18:46" timestamps).
- **LanaeHealth already does this** via MorningCheckIn + EveningCheckIn. Good.
- What LanaeHealth could add: show both in a single summary pill on the carousel card ("Stress AM: Mild / PM: Moderate") so the user sees the arc without expanding.

### F. Factor chips with intensity prefix
- "(Little) Alcohol", "(A lot) Caffeine", "(Little) Screen Time" — chips with a parenthetical intensity qualifier.
- Lets users tag factors without picking a scale each time.
- **Adapt:** LanaeHealth's CustomFactorsCard could adopt (Little/Some/A lot) as a 3-tap toggle rather than a slider.

### G. "Cat in Bedroom" moment
- They let users track deeply personal factors (a factor literally called "Cat in Bedroom" for sleep disruption).
- This is a permission to be personal. It signals "your weird health matters."
- **Adapt:** LanaeHealth's Custom Factors can surface examples like "Carried groceries upstairs", "Wore compression", "Argued with insurance" — real-life POTS/endo triggers.

### H. Routines as presets
- "Weekday / Rest day" one-tap factor presets.
- Saves tapping 6 chips when you've had the same day as usual.
- **Adapt:** LanaeHealth has EnergyMode (Full/Endo/Flare) — the same idea. Consider a one-tap "Same as yesterday" button on the logging screen that pre-fills 70% of factors from the prior day's log.

### I. Reminders UX
- One reminder, multiple times (09:00 on + 20:00 off).
- Day picker as 7 pills (Mo Tu We Th Fr Sa Su).
- "Every day" shortcut checkbox.
- **LanaeHealth audit:** CheckInReminders exists — verify it uses this same one-rule-many-times pattern instead of requiring N separate reminders.

---

## 4. Correlation readout (their single strongest pattern)

From the "Insights" screenshot:

### Card structure
- Card title: "Effect on {Anxiety}" (the outcome user cares about)
- Each row: `[emoji] [Factor name + intensity]   [colored bar → % impact]`
- Positive factors at top (worsening), colored red/pink, with `+22%`
- Negative factors below (improving), colored green, with `-22%`
- Bar length = magnitude of effect
- Bar color = direction (red = worsens, green = improves)

Example rows (paraphrased from their screenshot):
- 🫘 Caffeine (A lot) → +22% (red bar, long)
- 📱 Social media (A lot) → +18% (red bar, medium)
- 🛌 <7 hours sleep → +10% (red bar, short)
- 🏃 Morning run → -20% (green bar, long)
- 🧘 Meditation → -22% (green bar, long)
- 💨 Breathwork → -23% (green bar, longest)

### Why this works
- **One card per outcome** (Anxiety, Sleep quality, etc.), not one card per factor.
- **Ranked by magnitude** → the biggest lever is at the top.
- **Color + sign + bar length** triple-encode direction, so you can read it in a glance.
- **Rows are conversational** ("<7 hours sleep" as a label, not "sleep_duration_lt_7").

### Adapt for LanaeHealth Patterns page
- The correlation_results table already has: factor, outcome, effect_size, p_value.
- New UI layout:
  - Pick an outcome (e.g., "Orthostatic delta", "Migraine severity", "Fatigue")
  - Show a "Effect on {outcome}" card
  - Rows sorted by |effect_size|, top 8
  - Color by sign (red worsens, green improves) using sage/blush palette:
    - Improves = sage `#6B9080`
    - Worsens = blush `#D4A0A0`
  - Bar width = |effect_size| / max_effect_size
  - Label rendering uses natural language (Clinical Intelligence Engine already has this — reuse)

This is probably the single highest-leverage change we can make.

---

## 5. What NOT to adopt

- **Emoji-heavy prose** ("✅ Simple & Customisable"). LanaeHealth is a medical product used at real doctor appointments. Tone should be warm but not toy-like. Use emoji sparingly (maybe only in user-generated content like custom factor labels).
- **Dark navy headlines / cool blue bg.** LanaeHealth's cream/blush/sage is warmer and more distinctive. Don't lose that.
- **"Health entries in seconds" marketing.** LanaeHealth is fine with 2-minute entries if they're thorough — it's not competing on speed with a casual tracker. Compete on "Here's what's actually going on with your body."
- **Generic condition list SEO pages** (their chronic-illness-tracker, adhd-tracker, etc.). LanaeHealth is single-patient — no need to SEO every condition.
- **Pixel copy of their polar-bear branding.** Bearable is the bear. LanaeHealth has its own identity.

---

## 6. Proposed adaptation plan (ranked by leverage)

### P0 — Ship this first (1 focused session)
1. **Rewrite the Patterns page correlation card** using the "Effect on {outcome}" pattern:
   - File: `src/app/patterns/page.tsx` (+ new `CorrelationCard.tsx`)
   - Data source: `correlation_results` table (already populated, 8 significant patterns)
   - Visuals: sage/blush bars, natural-language labels, ranked by |effect size|
   - Copy: "Effect on [X]" header, "Biggest improvers" / "Biggest worseners" section splits

### P1 — Voice pass (half session)
2. **Homepage/landing copy** — if there's a marketing page, rewrite the hero:
   - Outcome headline: "Understand what your body is actually telling you."
   - Animated line: "See how [salt] affects your [orthostatic delta]" rotating Lanae-specific pairs
3. **Log page intro copy** — warm empathetic micro-copy on each card header

### P2 — Log IA polish (1 session)
4. **Count badges on carousel card headers** — "Symptoms 3 · Mood · Sleep 7h 20"
5. **"Same as yesterday" one-tap prefill** button above the carousel
6. **Group SymptomPills by body system** matching the Clinical Intelligence Engine taxonomy

### P3 — Nice-to-haves (later)
7. Reminder UX review (one-rule-many-times pattern)
8. 3-pill severity mode toggle (as alt to 0-10 slider)
9. Consistent "Today, {date}" header across all log surfaces

---

## 7. Screenshots reference (for the design session)

All captured in `docs/research/bearable/screenshots/`:
- `bearable-home-viewport.png` — hero
- `bearable-home-fullpage.png` — full marketing page
- `bearable-home-mid1.png` — trust/credibility section
- `bearable-home-features-2200.png` — 3 app mockups (tracking, factors, reminders)
- `bearable-home-correlations-1400.png` — insights/correlation card
- `bearable-appstore-top.png` — App Store listing

These are for studying patterns only, not reproducing wholesale.

---

## 8. Open questions for decision

1. **Which P0 area first?** I'd start with the Patterns page correlation card — it's the highest-leverage change, you have the data, and it's visibly different from what's there now.
2. **Do you want me to spec the CorrelationCard component** (props, states, empty states) before writing code?
3. **Should the voice pass target a specific page or the whole app**? Log page is most-viewed; home/landing would be highest-impact if there's a public marketing site.
