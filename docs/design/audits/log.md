# /log Design Audit

**Route:** `/log` (Daily Story check-in flow for Lanae)
**Audited:** 2026-04-16
**Screenshots:** `docs/design/before-after/log/before/` (375, 768, 1440)

## Purpose

`/log` is the highest-frequency daily entry point for Lanae. It records pain, mood, energy, symptoms, food, meds, hydration, weather-context, sleep reflections, cycle, and free-form notes. The surface lives as two daylight-aware check-ins (`MorningCheckIn`, `EveningCheckIn`) plus an off-hours landing view. It must feel low-friction: every additional word or pixel is a tax on a sick person.

## First impression

### 375 (mobile)
Dense vertical list of cards. Crowded but legible. Content is already mobile-first; nothing overflows. Three em-dashes visible in the above-the-fold frame (problems list, stress caption, hydration units). Weather card uses small-caps lab-style labels which makes it feel clinical. Two emoji rows (mood + overall feeling) appear within the same scroll arc and read as redundant.

### 768 (tablet)
Same single-column layout at 640px max-width, centered. Feels fine, though empty lateral whitespace starts to appear. The redundancy of "Overall mood today?" and "Overall feeling" is more pronounced at this width because both rows are wider.

### 1440 (desktop)
The mobile column sits centered in a ~1440px viewport with large empty flanks on both sides. This is the exact pattern `design-decisions.md` §13 forbids. The route reads "we forgot to design for desktop."

## Visual hierarchy

- `h1 "How was today?"` is clearly primary.
- Subtitle uses `·` separator which is clean.
- The "Already logged today" pill is discreet sage and reads as confirming, good.
- Section cards are uniformly `#FFFDF9` with 1px sage 15% border. Repetitive but safe.
- Weather card's `TEMP / PRESSURE / HUMIDITY` small-caps labels are the only shouty element. Clashes with surrounding sentence-case labels.
- `PATTERN (STRONG)` uppercase eyebrow on the insight banner is similarly shouty and the only other uppercase badge on screen.

## Clarity of purpose

- The page answers "How was today?" cleanly. That is its one job.
- The two-emoji rows (mood vs overall feeling) muddle the signal. Either these are the same question (and one should go) or they mean different things (and the labels must clarify). Today the visuals are identical so Lanae cannot tell.
- `Pain level now (yesterday: →)` is cryptic. "Yesterday" without the number on the same line requires Lanae to scroll or re-read. Concrete inline value is better.
- `Anything bothering you?` + symptom pill instruction `Tap once for moderate, again for severe, again to remove.` is accurate but verbose and repeats on morning and evening check-ins.

## Consistency violations (design-decisions.md)

- §15 Em dashes: `Dysmenorrhea — Painful periods, formally diagnosed` (active problems pill), `0 calm — 10 overwhelming` (stress + sleep captions), `Labs, discharge papers, app exports — we'll parse and merge`, `Text for your doctor or family — one tap`, `Δ {delta} bpm — …`, `LanaeHealth Daily Summary — …`, `⚠️ FLARE DAY — flagged for doctor review`, the "edit anything below" header, the `m.name — m.dose` tooltip. Multiple `&mdash;` entities used in the JSX.
- §5 Microcopy: `Saving...` literal string in `MorningCheckIn`, `EveningCheckIn`, `OuraSyncIndicator`, `VoiceNote`. `Loading your day...` in `DailyStoryClient`. `Transcribing...` in VoiceNote. `...` inside `shortName` for long med names.
- §3 Scarce accent: sage-filled primary buttons appear simultaneously — the mood-emoji active state, the active overall-feeling emoji, the `+` hydration buttons, the `Add` gratitude button (gold but strong), the VoiceNote button, and the `Done with morning` CTA. At best 4-5 sage surfaces are active at once in the mid-scroll viewport.
- §8 Shadows: `CheckInDoneButton` writes `boxShadow: '0 1px 3px rgba(107,144,128,0.2), 0 8px 24px rgba(107,144,128,0.35)'` inline. Must be a token.
- §9 Tabular numerics: pain score, stress score, sleep quality score, hydration count, cycle day, orthostatic Δ, BBT, weather values all lack `className="tabular"`.
- §11 Loading language: `Saving...` strings — ellipses and the active progressive form both forbidden. `Transcribing...` same.
- §13 Desktop layout: `max-w-2xl mx-auto` only. No `.route-desktop-wide` or split layout.
- §10 Interactive states: Flare, mood emojis, pain pills, med pills, food pills all have hover/active but no consistent use of `.press-feedback`. Mood emojis use `transition` alone without duration/ease tokens.
- §4 Empty state voice: `No recent meals yet.` and `No meds in your profile yet. Tap Edit in detail to add.` are close, but lack warmth.

## Delight factor: 5/10

Baseline usable. The cream/sage palette is calming, the emoji rows are friendly, the insight banner feels thoughtful. But the redundancy, the shouty eyebrow labels, the em-dashes, the `Saving...` ellipses, and the centered-on-a-1440 viewport make it feel unfinished rather than crafted.

Redeemers: the flare toggle card is genuinely warm, the appointment card's "Prep doctor mode" chip is well done, the 4-7-8 breathing exercise is a lovely touch, the `CheckInDoneButton` with `sectionsLogged/totalSections` is a nice non-shaming progress cue.

## Interactive states inventory

| Element | Resting | Hover | Active | Focus | Loading | Disabled |
|---|---|---|---|---|---|---|
| MoodQuickRow buttons | yes | CSS transition only | aria-pressed | global | opacity | opacity |
| Overall feeling buttons | yes | transition only | aria-pressed | global | none | none |
| Symptom pills | yes | none | aria-pressed | global | opacity | opacity |
| Med pills | yes | none | aria-pressed | global | opacity | opacity |
| Food pills | yes | none | aria-pressed | global | opacity | opacity |
| Pain region pills | yes | none | aria-pressed | global | opacity | opacity |
| Flare toggle button | yes | none | aria-pressed | global | opacity | none |
| Hydration `+`/`-` | yes | none | none | global | none | none |
| Voice button | yes | none | none | global | recording state | opacity |
| CheckInDoneButton | yes | none | clicked state | global | clicked | opacity |
| Share/Copy | yes | none | copied state | global | none | none |
| Sliders | yes | accentColor | thumb native | global | none | none |

All interactive elements lack explicit press-down feedback, hover lift, or shimmer-top loading. The `.press-feedback` class is nowhere on the route.

## Empty states inventory

| Context | Current copy | Verdict |
|---|---|---|
| No Oura last night | `No wearable data for last night yet. Log sleep manually` | OK, could use template |
| No recent meals | `No recent meals yet.` | Fails template §4 |
| No meds in profile | `No meds in your profile yet. Tap Edit in detail to add.` | Acceptable, slight rewrite |
| No cycle/phase | Component returns null | Missing; silently absent |
| Pain region row | prompt `Tap to mark; pain set to 1 if not yet set` | Clear, keep |
| Flare day off-state | `Tap if today is a bad day you want your doctor to see` | Uses "bad day"; tighten |

## Microcopy audit

| Location | Current | Issue | Rewrite |
|---|---|---|---|
| Header badge | `Already logged today — edit anything below` | em dash | `Already logged today. Edit anything below` |
| Flare off | `Tap if today is a bad day you want your doctor to see` | "bad day" per §6 | `Tap if today is a tough day you want flagged for your doctor` |
| Sleep label caption | `0-10 scale` | fine | keep |
| Stress caption | `0 calm — 10 overwhelming` | em dash | `0 calm to 10 overwhelming` |
| Overall mood row | `Overall mood today?` | duplicates overall feeling | `Overall mood today` |
| Overall feeling row | `Overall feeling` | duplicates mood | `How did today feel overall?` with body-feeling framing |
| Bothering prompt | `Anything bothering you?` Subtitle: `Tap once for moderate, again for severe, again to remove.` | verbose | Keep prompt; subtitle `Tap once for moderate, again for severe, again to clear` |
| Pain label | `Pain level now (yesterday: →)` | cryptic | `Pain level now` + inline `Yesterday was {n}/10` |
| Notes prompt | `Anything notable?` placeholder `What stood out about today... or tap Voice` | ellipsis | `What stood out about today, or tap Voice` |
| Morning notes placeholder | `Dreams, wake-ups, how you feel as you get up... or tap Voice` | ellipsis | `Dreams, wake-ups, how you feel as you get up, or tap Voice` |
| Autosave hint | `Autosaves as you go` | OK but safer as we-voice | `We save as you type` |
| Save state | `Saving...` `Saved` | ellipsis | `Saving` `Saved` |
| Active problems active tooltip in PrefilledDataCard | n/a | n/a | n/a |
| Loading fallback | `Loading your day...` | ellipsis | `One moment, pulling your day` |
| VoiceNote transcribing | `Transcribing...` | ellipsis | `Transcribing` |
| Oura re-sync | `Syncing...` | ellipsis | `Syncing` |
| CheckInDoneButton message | `Saved. Great work today.` / `Saved. Come back anytime.` | fine | keep |
| InsightBanner eyebrow | `PATTERN (STRONG)` all-caps | soften | `Pattern: {type}` sentence case |
| Weather labels | `TEMP` / `PRESSURE` / `HUMIDITY` | shouty | `Temperature` / `Pressure` / `Humidity` |
| Share card subtitle | `Text for your doctor or family — one tap` | em dash | `Text for your doctor or family in one tap` |
| Share card summary text | `LanaeHealth Daily Summary — {date}` | em dash | `LanaeHealth Daily Summary · {date}` |
| Share flare line | `⚠️ FLARE DAY — flagged for doctor review` | em dash | `⚠️ FLARE DAY · flagged for doctor review` |
| Share symptom severity | built via ` — ` | em dash | use `; ` separator |
| Orthostatic verdict | `Δ {delta} bpm — ...` | em dash | `Δ {delta} bpm. ...` |
| Import card subtitle | `Labs, discharge papers, app exports — we'll parse and merge` | em dash | `Labs, discharge papers, app exports. We'll parse and merge.` |
| Dysmenorrhea chip (active problems) | `Dysmenorrhea — Painful periods, formally diagnosed` | em dash | `Dysmenorrhea: Painful periods, formally diagnosed` |

## Fix plan

### Blockers (design-decisions.md §15, §11)
1. Remove all em dashes in `/log` lane. Replace with colon, comma, period, or `·`.
2. Remove all `...` in UI strings. `Saving`, `Transcribing`, `Syncing`, `One moment`.
3. Replace inline shadow formula in `CheckInDoneButton` with `var(--shadow-md)` + hover `var(--shadow-lg)`.

### High (§3, §9, §13)
4. Add `className="tabular"` to every numeric value rendered (pain, stress, sleep quality, hydration count, Δ, BBT, weather temp/pressure/humidity, streak count, logging progress `n/5`, oura stats, orthostatic HR).
5. Wrap the route in a `.route-desktop-wide` container (max-w 820px) at `>=1024px`. Leverages the existing CSS rule.
6. Demote duplicate sage-filled emojis: one emoji row remains sage-active. The other uses blush-tinted active state with a distinct label so it's clearly a different axis.
7. Soften `InsightBanner` eyebrow from uppercase `PATTERN (STRONG)` to sentence-case `Pattern: …` with the confidence as a muted tail.

### Medium (§4, §5, §6)
8. Merge / clarify the two emoji rows: morning stays as `Mood`, evening keeps `Overall feeling`. When both are in the same check-in (evening has `Overall mood today?` + `Overall feeling`), relabel and re-style so the second row uses the feeling-as-energy framing and muted blush active state.
9. Replace `Pain level now (yesterday: →)` with concrete `Yesterday was {n}/10` caption.
10. Rewrite empty-state copy for recent meals & meds to `§4` template.
11. Normalize `Flare day` copy to remove "bad day" language (§6).
12. Normalize weather label casing to sentence-case.

### Polish (§10, §7)
13. Add `press-feedback` class to all interactive pill/button elements.
14. Use `var(--duration-fast) var(--ease-standard)` explicitly on pill transitions instead of plain `transition`.
15. Add `.tabular` on long counts and percentages for alignment.
