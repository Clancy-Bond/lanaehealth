# Clue -- Observed Patterns

Last updated: 2026-04-16

Each pattern is one H2. Ranked by Lanae impact (1-5 stars) where 5 = directly addresses endo, POTS, irregular cycles, or doctor visits.

---

## Uncertainty-honest cycle prediction

Stars: 5/5

**What it is**
Predictions are shown as ranges, not single dates. When input is weak (first cycle, irregular history, recent cycle skipped), the range widens and the UI adds a plain-language note: "Predictions may be less accurate because your last cycle was irregular." Confirmed past days are solid-filled; predicted future days are dashed outlines.

**Why it works**
Users stop blaming themselves when predictions are wrong. Honesty builds trust. Doctors appreciate users who know the difference between confirmed data and modeled data. Dashed vs solid is a near-universal visual convention for predicted vs actual.

**Trade-offs**
Some users want a single confident date and find ranges anxiety-provoking. Counter: make the center of the range prominent, collapse the range visually unless uncertainty is high.

**Adaptability to LanaeHealth**
Direct adopt. Our cycle view at `src/components/patterns/` can render dashed vs solid day chips, and we already have signal strength data (BBT + Oura + HRV). Add a confidence band to the period prediction, label it "predicted range" with a tooltip that lists which signals contributed. This slots cleanly into our Warm Modern palette using phase colors with varying opacity.

---

## Granular consent and export transparency

Stars: 5/5

**What it is**
At onboarding, each data use (analytics, research participation, crash reports, marketing) is a separate toggle with a plain-language explanation. Users can later review and revoke each toggle in Settings. Data export is CSV and JSON, not screenshot PDF. The export is complete, not a summary.

**Why it works**
Post-Roe, post-Flo-lawsuit users no longer trust blanket "we respect your privacy" statements. Specific toggles with specific explanations are the new trust floor. Open-format export signals "your data is yours" in the strongest way.

**Trade-offs**
More friction at onboarding. Counter: default to the minimum (only essential data use on) and let users opt in later.

**Adaptability to LanaeHealth**
Direct adopt. We have an advantage: our data is in Lanae's own Supabase, not a shared cloud. Build a Privacy Settings section under `src/app/settings/` with three toggles (Claude API usage, correlation analysis, long-term storage) with plain text explaining each. Add a "Download all my data" button that exports every Supabase row she has as a ZIP of CSV + JSON.

---

## Symptom taxonomy organized like a clinician would

Stars: 4/5

**What it is**
Clue groups symptoms into clinician-style categories: Pain (by body region), Skin, Hair, Sleep, Mental, Energy, Digestion, Stool (Bristol scale), Sexuality, Bleeding. Each category is a separate logging flow. Users see trends per category, not a firehose.

**Why it works**
Clinicians think in organ systems. Users who want to share with doctors benefit from speaking the same language. It also reduces cognitive load compared to a flat list of 70+ symptoms.

**Trade-offs**
Slightly slower to log a single symptom because users must first pick a category. Counter: surface recent symptoms at top of log view.

**Adaptability to LanaeHealth**
Strong adopt. Our Log page has 60 components but needs a clinician-grouped view for Lanae to log faster. Add an organ-system grouping to `src/components/log/` that maps to our existing `symptoms` table. Endo-specific additions: Pelvic pain by location, dyspareunia, GI cycle symptoms, bladder irritation. This matches our `pain_points` table structure.

---

## Probabilistic fertile window (curve, not binary)

Stars: 4/5

**What it is**
Instead of showing a green "fertile" block and red "not fertile" block, Clue displays a gradient curve of probability across the whole cycle. Peak fertility sits at the top of the curve. The edges of the curve show "slightly elevated probability" rather than a hard cutoff.

**Why it works**
Ovulation timing is variable even in regular cycles. A binary window teaches false confidence. A curve teaches the actual biology.

**Trade-offs**
Harder to glance at than a binary window. Counter: annotate the peak with a label, so users still get a headline number.

**Adaptability to LanaeHealth**
Adopt with Oura enhancement. Use a sparkline under the cycle view at `src/app/patterns/page.tsx` showing the fertility probability curve, sourced from our multi-signal cycle engine. The curve width is tighter when Oura temperature shift is clear, wider when signals conflict, which is a visual expression of signal confidence.

---

## Articles integrated contextually into the logging flow

Stars: 4/5

**What it is**
When a user logs a symptom that matches a clinical pattern (e.g., skin breakout in luteal phase), Clue shows a "Learn about this" link that opens a gynecologist-authored article. Articles have inline citations and "last reviewed" dates.

**Why it works**
Education at the point of curiosity has 10x the engagement of education in a separate library. Timed contextually, it teaches users about their body when the question is fresh.

**Trade-offs**
Content team is expensive to maintain. Counter: for us, Claude plus a clinical reference library can generate contextual snippets on demand.

**Adaptability to LanaeHealth**
Strong adopt. After logging pelvic pain in luteal phase, surface a small "Learn why pain worsens in luteal phase" card with a short AI-generated explanation that pulls from our existing permanent core context. Citations link to PubMed DOIs. Fits cleanly with our existing Intelligence page at `src/app/intelligence/`.

---

## Minimalist, ungendered visual design

Stars: 3/5

**What it is**
No pink. No sparkles. No flowers. No moon emojis. Typography is a clean sans-serif. Charts use muted teal, orange, grey. The design is what you'd expect from a medical-grade SaaS tool, not a consumer "feminine" app.

**Why it works**
Serves non-binary users, older users, clinicians, and users who just want a professional tool. It also raises perceived authority.

**Trade-offs**
Can feel sterile. Counter: we're already softer (cream, blush, sage) so we land in a nicer middle.

**Adaptability to LanaeHealth**
Already aligned. Our Warm Modern palette is softer than Clue but still adult and ungendered.

---

## Anovulatory cycle detection

Stars: 5/5

**What it is**
Clue's algorithm flags cycles where no clear ovulation signal occurred. Rather than extend the prediction forward, it surfaces a note: "We didn't detect ovulation in this cycle. This is normal occasionally but worth noting if it happens repeatedly."

**Why it works**
Anovulatory cycles matter clinically (PCOS, perimenopause, stress, endo). Most apps silently paper over them and damage prediction quality. Clue treats the user as an informed adult.

**Trade-offs**
Can scare users. Counter: the copy is reassuring about occasional occurrence and specific about when to consult a doctor.

**Adaptability to LanaeHealth**
Direct adopt. Our multi-signal cycle engine already has the ingredients (no temp biphasic shift + no LH surge). Add an Anovulatory flag with user-facing copy matching this honest-but-reassuring tone. Record in correlation_results so it surfaces in doctor report.

---

## Partner sharing, minimal and opt-in (Clue Connect)

Stars: 3/5

**What it is**
Partner sees cycle phase and predicted period window only. No symptom detail, no mood, no intimate log entries. User controls exactly what's shared. One-click revoke.

**Why it works**
Partner transparency without intimate data exposure. Especially important post-Roe where a bad relationship could weaponize data.

**Trade-offs**
One-way only in Clue's current design. We could do better.

**Adaptability to LanaeHealth**
Skip for v1. Low Lanae impact, expensive to build. Revisit if Lanae explicitly requests.

---

## "Why" prompt after logging (reflective journaling)

Stars: 2/5

**What it is**
After logging a symptom, Clue occasionally prompts "What else happened today?" to capture free-text context. Text is stored but not parsed by default.

**Why it works**
Narrative context makes historical data meaningful.

**Trade-offs**
Adds friction.

**Adaptability to LanaeHealth**
Already partly have this via our log text fields. Low priority.

---
