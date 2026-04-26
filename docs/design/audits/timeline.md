# /timeline Design Audit

**Route:** `/timeline` (Chronological medical history for Lanae)
**Audited:** 2026-04-16
**Screenshots:** `docs/design/before-after/timeline/before/` (375, 768, 1440)

## Purpose

`/timeline` is Lanae's chronological medical history: diagnoses, symptoms, tests, medications, appointments, imaging, and hospital events. The route must answer the single question: **"what happened to my body, in order, and when?"** It should let her scroll through 40+ events and locate something like "when did my iron supplementation start" in under 10 seconds.

## First impression

### 375 (mobile)
A sage-filled "Add Event" button dominates the top. Below it, a horizontal filter chip row. Then a vertical rail with colored dots and event cards. Content is legible and moderately dense. Every row ships its full date (e.g., "Apr 9, 2026"), creating visual noise when two adjacent rows share a month. The same "Tap to expand" hint repeats on most rows. Some red/orange dots carry "Critical" labels that feel alarming against a cream background.

### 768 (tablet)
Same narrow mobile column inside a 640px max-width centered block. Works, but starts to feel under-dressed.

### 1440 (desktop)
Mobile column centered in a 1440px viewport. Large empty flanks. Exact pattern forbidden by §13 of the contract. Reads as "no desktop design shipped."

## Visual hierarchy

- `h1 "Timeline"` is clearly primary.
- Subtitle "Your complete medical history at a glance" is warm but static.
- Primary "Add Event" button is sage-filled. The design contract allows ONE sage-primary per viewport; this is the only one here, so it passes §3.
- Filter chips are a mix: active "All" is sage-filled (good), but the others are flat `--bg-elevated` without an outline, so they read as weak.
- Each event row competes with itself: date, title, colored badge, "Tap to expand" hint, and on some rows an extra yellow "Important" or red "Critical" pill.

## Clarity of purpose

- The vertical rail + colored dot pattern is correct (matches Notion Calendar / Strava). Dot colors correlate to event type, which is learnable.
- Because every row shows a date in full, scanning month-over-month is harder than it needs to be. Date grouping by month (or just suppressing the repeat month/year) would tighten the scan.
- `{n} event(s)` count below filter pills is redundant with the badge counts already on each chip.
- The "No {category} recorded" message when a filter matches zero events is dry and breaks the warm voice contract.

## Consistency violations (design-decisions.md)

- §3 Scarce accent: passes at rest; filled green "Add Event" is the only sage primary.
- §4 Empty-state voice: "No timeline events yet" / "Add your first event using the button above" - too cold. Filter-empty state "No diagnoses recorded" - cold.
- §5 Microcopy: `Saving...` with ellipsis in AddEventForm submit button. "Tap to expand" is fine but repeats on every row, which is noise.
- §7 Color: `hospitalization` returns raw red `#EF4444`; "Critical" badge uses red `#EF4444`. Red is forbidden as a primary accent. Must desaturate to blush or warm neutral.
- §8 Shadow: AddEventForm uses `var(--shadow-sm)` - good. TimelineClient uses a raw inline `boxShadow: "0 0 0 2px ${color}33"` on each dot - acceptable as a 1-token halo effect but should be minimized.
- §9 Tabular numerics: date strings (`time` element) and count badges on filter chips lack `.tabular`.
- §10 Interactive states: row button has no hover / press feedback; filter chips lack `.pill` + `.pill-active` pattern; dots have a ring but no press interaction.
- §11 Loading language: `<Loader2 size={14} className="animate-spin" />` in AddEventForm. Forbidden spinner.
- §13 Desktop layout: pure mobile column, no split or wide variant.
- §15 Prohibited patterns: Loader2 + animate-spin + "Saving..." trifecta in AddEventForm.

## Delight factor: 5/10

The vertical rail with colored dots is already genuinely charming, the strongest pattern on the route. But repetitive dates, "Tap to expand" noise, and the red Critical pill flatten what could be a warm, restful reading experience.

## Interactive states

- Filter chips: color change only, no `.pill` class, no focus-visible treatment beyond default.
- Event row button: no hover shift, no press-scale, no keyboard press-feedback.
- Dots: purely decorative, not individually tappable (fine).
- Add Event submit: no fill-on-save, just a spinner.

## Empty states

- No events at all: "No timeline events yet / Add your first event using the button above" - fails §4.
- Filter-empty: "No diagnoses recorded" - fails §4.

## Microcopy audit

| Location | Old | New |
| --- | --- | --- |
| Page subtitle | "Your complete medical history at a glance" | "Your health story, in order" |
| AddEventForm submit | "Saving..." / spinner | "Saving" / shimmer-bar (no spinner) |
| AddEventForm saved state | (none) | "Saved" briefly |
| Empty (no events) | "No timeline events yet" | "Your timeline is waiting for its first event. Tap the green button to add one." |
| Empty (filter) | "No diagnoses recorded" | "Nothing tagged as Diagnoses yet." |
| Row hint | "Tap to expand" | (remove when no description; "See details" when there is one) |
| Severity "Critical" | Red pill | "Watch closely" blush-tinted chip |
| Severity "Important" | Amber pill | keep label, muted amber (retain) |
| Type "Hospital" | Red dot + "Hospital" label | Blush dot + "ER visit" chip |
| Filter-empty tone | cold | warm: "Nothing tagged as X yet." |

## Fix plan (priority order)

### Blocker
1. Replace `<Loader2 className="animate-spin" />` + "Saving..." in `AddEventForm.tsx` with `.shimmer-bar` and "Saving" label.
2. Remove red `#EF4444` from `hospitalization` color mapping; replace with blush `#D4A0A0`.
3. Rewrite significance "Critical" badge to use blush palette and warmer label "Watch closely"; confirm no em dashes anywhere.

### High
4. Empty-state rewrite (both no-events and filter-empty) per §4.
5. Convert filter chips from inline-styled buttons to `.pill` / `.pill-active` utility classes; add `.press-feedback`.
6. Add `.press-feedback` to every event row button; add `.tabular` to dates.
7. Collapse "Tap to expand" hint: only show "See details" when event has a description.
8. Desktop (>=1024px): wrap the feed in `.route-desktop-wide` so the column becomes a deliberately narrow reading experience (820px).

### Medium
9. De-duplicate repeated date labels within the same month: prefix a subtle month header every time the month changes (soft, 0.8x subtle color, tabular).
10. Page subtitle rewrite to "Your health story, in order."
11. Soften Submit button to use fill-on-save motion (progress-fill keyframe from globals), with press-feedback class.
12. Count-badge inside each chip already works; add `.tabular` class to the number.

### Polish
13. Dot halo shadow: keep the current `{color}33` 2px ring; it is a single token-less formula but is tightly bound to the dynamic color. Acceptable exception noted.
14. Ensure hospital icon / label everywhere uses softened language "ER visit".
