# Daylio Patterns

One pattern per section. Each ranked by Lanae impact (1 to 5 stars). Patterns that conflict with design-decisions.md rules (e.g., streak guilt) are rejected up front.

---

## 1. 5-face mood scale

**Stars:** 5 / 5

**What it is:** Mood is expressed as one of 5 faces (Rad, Good, Meh, Bad, Awful by default, all renameable). Tap once to log. No number selection, no slider.

**Why it works:**
- Removes calibration anxiety. A 1-10 scale forces the user to ask "is today a 6 or a 7?" Faces short-circuit the question.
- Visual pattern matching is faster than numeric reasoning, especially under cognitive load (fatigue, brain fog, crisis).
- 5 options force differentiation without paralysis. Research on Likert scales supports 5 to 7 as the psychometric sweet spot.
- Renameable labels let the user make the scale personal ("Rough" instead of "Awful").

**Trade-offs:**
- Coarse on bad days. Users with wide negative emotional range (bipolar, chronic pain flares) report the lowest face flattens real variance.
- Not clinically validated. Unlike PHQ-9, PCL-5, or the VAS, 5 emoji faces have no research citation.
- Custom moods require premium in Daylio.

**Adaptability to LanaeHealth:**
- LanaeHealth ALREADY has this via `MoodCard.tsx` and `MoodQuickRow.tsx` (5 emoji faces, 1 to 5 scale, stored in `mood_entries.mood_score`).
- Missing: mood renaming. Lanae should be able to relabel "Terrible" as "Rough flare" or similar.
- Missing: custom mood labels per cycle phase or per context (morning, evening).
- Missing: tap-once-done confirmation. Current MoodCard expects also emotion tags.

---

## 2. Activity icon grid (tap to log, no typing)

**Stars:** 5 / 5

**What it is:** Below the mood scale, a grid of icons representing activities ("coffee", "walk", "period", "slept well", "social"). Tap to toggle each. Organized into groups (Movement, Food, Mind, Body, Social). User can add unlimited custom icons.

**Why it works:**
- Icons are 3x to 5x faster to scan and tap than text labels.
- Toggling is frictionless, multi-select is atomic, no typing.
- Grouping limits cognitive load to one group at a time.
- Visual memory is better than textual memory, so users log more consistently.

**Trade-offs:**
- Icon library is fixed (in Daylio, users cannot upload custom PNGs).
- Without groups, the grid becomes a wall of 60 icons and loses scannability.

**Adaptability to LanaeHealth:**
- LanaeHealth partially has this via `SymptomPillRow.tsx` and `CustomFactorsCard.tsx`. But pills are text, not icons.
- Introduce an icon-forward "Quick Factors" grid for fast logging of activities, symptoms, and factors with visual tiles.
- Supabase already has `custom_trackables` table (migration 009). Add `icon` field (already exists) and render.
- Pre-populate Lanae-specific defaults (coffee, bath, lying flat, compression socks, salt, electrolytes, long stand, missed meal).

---

## 3. Year-in-Pixels calendar heatmap

**Stars:** 5 / 5

**What it is:** A 12-column by 31-row grid of tiny squares, one per day. Each square colored by that day's dominant mood. Scroll back years. Visual at a glance.

**Why it works:**
- Zooms out to a level no other view offers. Users see months of pattern in one glance.
- Reveals clusters the user never noticed ("October is all red"), which drives insight.
- Emotionally resonant. A year of green squares feels like a trophy. A year of red tells a story.
- Zero text, zero interpretation needed.

**Trade-offs:**
- Low-data days ambiguous. Missing days are blank and can look like bad days if styling is wrong.
- Color perception varies (colorblindness). Need alternate encoding (texture or numeral overlay).
- Single-metric only. Showing mood hides the factors that caused mood.

**Adaptability to LanaeHealth:**
- HIGH FIT. Lanae's data is already day-indexed (`daily_logs`). Building the grid is pure rendering.
- Extension opportunity: toggle the pixel color between mood, pain, fatigue, flow, sleep score, HRV. Same grid, different lens.
- Cycle phase overlay (menstrual days bordered red) creates visual cycle-mood correlation for doctor visits.
- Should live on the Patterns page or a new `/year` route.

---

## 4. Mood-activity correlation (top 5 best vs worst)

**Stars:** 4 / 5

**What it is:** Stats page shows a side-by-side comparison. Left column: top 5 most common activities on "Rad" days. Right column: top 5 on "Awful" days. Instantly actionable.

**Why it works:**
- Not a correlation coefficient (too technical). Not a scatter plot (too dense). Just a frequency comparison.
- Actionable: "I drink coffee on 80% of my awful days and 20% of my rad days" reads as a lifestyle insight in two seconds.
- No math required from the user.
- Side-by-side framing produces "this thing vs that thing" clarity.

**Trade-offs:**
- Correlation is not causation. Coffee may correlate with awful days because bad days drive coffee, not vice versa.
- Small sample sizes produce misleading ratios (e.g., 2 rad days with coffee looks like 100%).
- Confounded by co-occurring factors.

**Adaptability to LanaeHealth:**
- LanaeHealth already runs a correlation engine (8 significant patterns in `correlation_results`).
- Current presentation is clinical. Daylio-style "top 5 factors on your best days vs worst days" is more digestible for Lanae.
- Add a card to Patterns page: "On your Rad days, you had: [sage, electrolytes, bath, lying flat, slept 8+]. On your Awful days: [stood >1hr, skipped meal, 6hr sleep, coffee, stress]."
- Requires enough logged custom trackables. Lanae's `custom_trackables` is provisioned but underused.

---

## 5. Multiple daily entries

**Stars:** 4 / 5

**What it is:** Entry flow allows the user to create multiple mood + activity logs per day, each with its own timestamp. Stats aggregate or display individually.

**Why it works:**
- Mood is not a daily constant. Morning anxiety, midday fine, evening crash is a common pattern (POTS, bipolar, PMDD).
- Daily aggregation flattens the variance signal.
- Timestamps enable within-day correlation with biometrics (HR, HRV, food intake).

**Trade-offs:**
- UI becomes more complex. A "log" can no longer be a single row.
- Aggregation strategy required for summary views (mean, median, max, last).
- More taps overall if users log 3 or 4 times per day.

**Adaptability to LanaeHealth:**
- LanaeHealth's `mood_entries` has `log_id` with UNIQUE constraint (one mood entry per day). This blocks multiple entries.
- Migration needed: drop the uniqueness constraint OR add a `sub_entry_index` column.
- UI layer: add a "Check in again" button in MoodCard.tsx, replay the face row, append to a timeline.
- Meshes with existing `MorningCheckIn.tsx` and `EveningCheckIn.tsx` components (already time-scoped).

---

## 6. Guilt-free missed days

**Stars:** 5 / 5

**What it is:** When the user opens the app after a multi-day gap, there is no penalty, no streak reset alarm, no guilt copy. Just the current day, ready to log.

**Why it works:**
- Chronic illness, depression, and life events cause predictable gaps. Shaming the user for them amplifies the shame that caused the gap.
- Reduces abandonment risk. Users who miss 3 days do not silently quit because the app treats them kindly.
- Aligns with therapeutic principles: consistency, not perfection.

**Trade-offs:**
- No gamification = no dopamine loop. Some users prefer Finch-style streaks (opposite philosophy).
- Requires disciplined copywriting. Any nudge can tip into guilt.

**Adaptability to LanaeHealth:**
- PERFECT FIT. LanaeHealth already has the anti-streak posture in design-decisions.md.
- Add missing-day copy: "Welcome back. Where would you like to start?" rather than "You missed 4 days".
- Ensure all reminders and nudges are context-aware and never tally missed days.

---

## 7. Customizable mood labels and activity icons

**Stars:** 4 / 5

**What it is:** Users can rename mood faces (e.g., "Awful" to "Rough"), add activity icons from a library, group activities, reorder groups. Free activities are unlimited. Premium unlocks custom mood labels.

**Why it works:**
- Personalization drives retention. An app named after your own framing is stickier than one with default labels.
- Vocabulary matters in chronic illness. "Bad day" for a healthy user is different from "bad day" for a chronic patient.
- Icon grouping scales to 60+ activities without overwhelming.

**Trade-offs:**
- Defaults must be good because most users never customize.
- Custom labels complicate analytics ("Rough" is not "Awful", merge logic needed).

**Adaptability to LanaeHealth:**
- Surface a settings panel: "Rename your mood scale". Storage: add `user_preferences.mood_labels` JSON.
- Pre-seed Lanae-specific activity icons (compression socks, salt tabs, lying flat, elevation, EFW).
- Group structure already supported via `custom_trackables.category`.

---

## 8. Export formats (CSV + PDF)

**Stars:** 3 / 5

**What it is:** One-tap export of entire history. CSV for spreadsheet nerds, PDF for therapists and doctors. Formatted, printable.

**Why it works:**
- Data ownership is a sales pitch. Users trust the app more when they can take data out.
- PDF export for doctor visits is a clinical-grade use case.
- CSV opens to every downstream tool (Excel, R, Python).

**Trade-offs:**
- PDF format is fixed, no customization of sections.
- Export is a premium gate in Daylio (~$4 one-time).

**Adaptability to LanaeHealth:**
- LanaeHealth already has `ShareDailySummary.tsx` and a Doctor report generator. Extends naturally to CSV mood export.
- Adding mood time series to the existing doctor PDF is straightforward.
- Low priority vs. the other patterns because Lanae's Doctor Report is already more comprehensive than Daylio's PDF.

---

## 9. Voice entry as alternative log path

**Stars:** 3 / 5

**What it is:** (Wished for by users, not shipped in Daylio.) Tap voice button, speak freely, transcribe to note field.

**Why it works:**
- Talking is faster than typing for long thoughts.
- Zero-typing path unlocks users with pain, fatigue, or short attention.

**Trade-offs:**
- Transcription errors.
- Privacy (requires mic permission).
- Transcription costs (per-minute API charges).

**Adaptability to LanaeHealth:**
- LanaeHealth HAS `VoiceNote.tsx`. Already exceeds Daylio here.
- Opportunity: tie voice note to mood entry as the "why" behind the face.

---

## 10. Lockscreen / widget quick entry

**Stars:** 2 / 5

**What it is:** iOS/Android widget shows 5 mood faces. One tap from the home screen logs mood without opening the app.

**Why it works:**
- Removes the last 3 seconds of friction (unlock, find app, open, wait, log).
- Increases entry frequency in ambient-log users.

**Trade-offs:**
- PWA widget support is spotty. Native widget requires Swift/Kotlin.
- Low ROI for LanaeHealth's next-web push since it is browser-based.

**Adaptability to LanaeHealth:**
- Out of scope for now. LanaeHealth is a PWA on Next.js.
- If we build a native wrapper later, revisit.

---

## Patterns to reject

### Streak counting

**Why rejected:** Explicitly conflicts with design-decisions.md principle of guilt-free missed days. Daylio itself does not stream count, and this is a strength.

### Mood-based achievement badges

**Why rejected:** "10 days in a row of Rad!" creates pressure to log Rad even when not. Distorts the data.

---

## Ranking summary

| Rank | Pattern | Stars | Why |
|------|---------|-------|-----|
| 1 | 5-face mood scale | 5 | Already partially shipped, low effort to polish |
| 2 | Activity icon grid | 5 | Major friction reducer on low-energy days |
| 3 | Year-in-Pixels | 5 | Visual storytelling for doctor visits, high impact |
| 4 | Guilt-free missed days | 5 | Already aligned with our philosophy, policy enforcement |
| 5 | Multiple daily entries | 4 | POTS-specific benefit, moderate effort |
| 6 | Top 5 best/worst correlation | 4 | Re-presentation of existing data |
| 7 | Customization | 4 | Retention driver |
| 8 | Export CSV/PDF | 3 | Already covered by Doctor Report |
| 9 | Voice entry | 3 | Already shipped via VoiceNote |
| 10 | Widget | 2 | Out of scope for PWA |
