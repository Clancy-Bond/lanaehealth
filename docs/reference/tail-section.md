# Session 05 tail - route-to-frame reference

Compact mapping for the 12 weekly-tail routes. Implementers are encouraged to open the PNGs directly; this file is a starting point, not a ceiling.

All paths are relative to `docs/reference/{app}/frames/full-tour/`.

## List-heavy (Oura chrome)

### `/v2/records` - unified timeline

Oura's list-and-card surfaces translate cleanly to the merged timeline.

- `oura/frame_0050.png` - Contributors ListRow pattern (leading icon, label, subtext, trailing stat). Clone for timeline rows.
- `oura/frame_0150.png` - card + row dividers + bottom-sheet lift. Clone for the month grouping card shell.
- `oura/frame_0030.png` - tab underline + chip filter. Adapt for kind + specialty chips at the top.

### `/v2/labs` - grouped by test_name, abnormal-first

- `oura/frame_0050.png` - ListRow repeated in a Card; same pattern.
- `oura/frame_0030.png` - segmented "Yesterday / Today" toggle. Adapt for "Abnormal / All" toggle.
- `oura/frame_0150.png` - sheet with trend chart inside. Model the sparkline cards after the sheet's chart framing.

### `/v2/imaging` - reports only

- `oura/frame_0050.png` - dense ListRow with modality-style trailing badge.
- `oura/frame_0150.png` - sheet for expanded report text.
- `natural-cycles/frame_0080.png` - cream explanatory banner. Adapt for the "open viewer on desktop" banner.

## Topic deep-dives (NC voice)

### `/v2/topics/orthostatic`

- `natural-cycles/frame_0160.png` - FAB on cream surface. Clone for "Log a test" FAB.
- `natural-cycles/frame_0080.png` - explainer card. Clone for the peak-rise definition card.
- `oura/frame_0001.png` - readiness ring. Adapt as diagnostic-progress ring (3 qualifying tests → full ring).
- `oura/frame_0050.png` - trend sparkline. Clone for peak-rise-over-time sparkline with 30 bpm reference line.

### `/v2/topics/orthostatic/new` - log form

- `natural-cycles/frame_0080.png` - form-on-cream card pattern. Adapt if we keep the form on dark chrome (default), or flip to cream if session lead prefers explanatory surface for medical data entry.
- Oura doesn't have a strong form reference; default to the `/v2/cycle/log` form style.

### `/v2/topics/cycle` - condition-focused deep-dive

- `natural-cycles/frame_0080.png` - phase explainer card.
- `natural-cycles/frame_0160.png` - fertile-day ring / cycle visualization. Adapt for the "CD 12, follicular phase" today card.
- Oura bar charts in the 0050-0150 range - adapt for the last-6-cycles bar chart.

### `/v2/topics/cycle/hormones`

- `natural-cycles/frame_0080.png` - card with a value + unit + range band. Clone for each hormone panel card.
- `oura/frame_0150.png` - sheet pattern for the add-entry sheet.

### `/v2/topics/nutrition` - fresh editorial

- `natural-cycles/frame_0080.png` - cream card stack with explanatory copy. Primary model.
- `natural-cycles/frame_0160.png` - condition-focused card with a bold color accent. Model for per-condition cards.
- No fixed reference for the "this week on your plate" section; compose from Oura metric tile + NC subtext.

## Settings + Import (mixed)

### `/v2/settings` - essentials + links out

- `oura/frame_0050.png` - iOS-style settings ListRow group pattern.
- `oura/frame_0150.png` - grouped cards with dividers.
- Any NC frame with a toggle - adapt for privacy toggles.

### `/v2/import/myah` - paste-text importer

- `natural-cycles/frame_0080.png` - wizard step + explanatory copy.
- `oura/frame_0150.png` - sheet for the parsed-rows preview.
- Default to `/v2/cycle/log` form conventions for the textarea and buttons.

## Light trackers (Oura + MFN)

### `/v2/calories/health/blood-pressure` + `/v2/calories/health/heart-rate`

MFN does not cover BP/HR tracking (food-only reference), so the primary model is Oura.

- `oura/frame_0001.png` - big-number hero with secondary stat. Clone for the most-recent card.
- `oura/frame_0050.png` - sparkline under a bar-chart card. Clone for the BP/HR trend sparkline.
- `oura/frame_0150.png` - recent-days vertical list. Clone for the last-20-readings list.

## Practical rules

- Do not paste the frames into the app. They are design reference, not assets.
- When you cite a frame in code comments, use the relative path `docs/reference/oura/frames/full-tour/frame_0050.png`.
- Visual fidelity target for this session: on-brand and mobile-correct, not pixel-perfect. If you are between two frame interpretations, pick the one that ships faster.
