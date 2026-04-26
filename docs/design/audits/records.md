# /records - Design Audit

**Route:** `/records`
**Files:** `src/app/records/page.tsx`, `src/components/records/{RecordsClient,LabsTab,AppointmentsTab,ImagingTab,TimelineTab}.tsx`
**Date:** 2026-04-16

## Purpose

A single hub for Lanae's medical artifacts: labs, imaging, appointments, and timeline events. The route exists to answer "what has happened, medically, and what's coming up?" It is the doctor-visit reference surface: when her PCP says "your ferritin was low last time," Lanae needs to surface that number in seconds.

## First impression (all 3 breakpoints)

- **375 (mobile):** Infinite ribbon of lab rows. Page scrolls to ~25,700px. No filter, no search, no summary. Tab pills visible. An "Add Result" button, a "Scan Photo" button (sage filled), and "Export" in a neutral pill.
- **768 (tablet):** Identical column-centered layout; feels lonely with all that empty horizontal space on each flank.
- **1440 (desktop):** Mobile layout centered in a massive viewport; flanks are empty cream. The list itself still scrolls ~25k pixels. This is exactly the pattern §13 of the contract forbids.

## Visual hierarchy

- The h1 is correct. The tab pills read clearly. Past this point, hierarchy collapses: every lab row visually weighs the same as the next; out-of-range values use red/orange type that reads anxious against cream; the date dividers are quiet. Nothing ever changes prominence so the eye has nowhere to rest.
- Scarce Accent Rule violated. On Labs tab alone the same viewport shows: sage "Labs" pill, sage "Scan Photo" button, sage "Add Result" button (muted), sage trend dots, sage trend toggle. Appointments tab: sage primary tab, sage "+ Add Appointment" button, sage date chip on every card (hundreds of sage elements if there are hundreds of cards). Timeline: sage filter chip, sage "Add Event" button.

## Clarity of purpose (can Lanae find a specific lab value in under 5 seconds?)

**No.** With 52 labs grouped by 2-3 dates and appointments/timeline at multi-hundred scroll depth, reaching a specific test requires scanning the full flat list. There is no search input, no alphabetical jump, no category filter on Labs, no "pin" or "recent abnormal" shortcut. This is the single biggest failure of the route.

## Consistency violations

1. Inline shadows are fine here (using `var(--shadow-sm)` / `var(--shadow-md)`). One exception: `AddLabForm` uses `boxShadow: 'var(--shadow-md)'` which is ok, but also a hard-coded `1.5px solid var(--accent-sage)` border that is inconsistent with other forms.
2. Raw hex colors in `flagColor` (`#3B82F6`, `#F97316`, `#EF4444`). `#EF4444` is a red severe color used directly on lab values, against §7 and §6.
3. `"Critical"` and `"High"` pill labels with red/orange backgrounds on lab rows violate §5 ("SEVERE DAY" vocab ban extends to lab flags) and §6 (no shouty alarms on chronic data).
4. "Saving..." with trailing ellipsis appears in `AddLabForm` submit (line 312) and `AppointmentsTab` submit. Violates §5 / §11.
5. `Loader2 ... animate-spin` spinner in `AddEventForm` (lives outside my lane). Will not be touched here (noted as deferred).
6. Raw numerics everywhere without `tabular`: lab values, reference ranges, date numbers on appointment cards, dates in timeline. Violates §9.
7. Timeline hospitalization dot hardcodes `#EF4444` (line 35 TimelineTab). Violates §7.
8. Appointment date chip uses sage as decorative background on every card - second violation of the Scarce Accent Rule.
9. No empty-state template applied; plain `<p>No lab results yet</p>` etc, no icons, flat. Violates §4.
10. Labs reference range string reads "Ref: 12 - 150 ng/mL" with hyphen rather than en-dash or "to". Fine per em-dash rule (hyphen is allowed), but the numbers should still be tabular.

## Delight factor

**4/10.** Functional but flat. No rhythm, no progressive disclosure, no sense of "here is what matters today." The chart-on-ferritin auto-expand is a nice touch; the appointment date chip concept is friendly. Everything else reads as a database dump.

## Interactive states inventory

- Tab pills: Rest/Active ok; no Hover, no Active-press, no Focus (inherits global but no visual distinction), no Loading, no Disabled.
- Appointment cards: Rest/expanded ok; no Hover, no Press, no keyboard-focus accent.
- Imaging cards: Same.
- Timeline rows: No Hover, no Press visual. Dots have no hover affordance.
- Trend toggle button: Rest/Active-background ok; no Hover.
- Add Result / Scan Photo / Export buttons: Rest only. No Hover lift, no Press shrink.
- "View in PACS Viewer" link: Rest only.

## Empty states inventory

- Labs empty: `"No lab results yet"` + `"Add results manually or scan a photo of your lab report"` - missing warm template, no icon, no sage tint.
- Imaging empty: `"No imaging studies yet"` + `"Imaging records will appear here once added"` - same flat treatment.
- Appointments empty: `"No appointments yet"` + `"Tap the button above to add your first appointment"` - same.
- Timeline empty: `"No timeline events yet"` + `"Add your first event using the button above"` - same.

All four fail the `.empty-state` template and warm voice rule.

## Microcopy audit

| String | Where | Fix |
| --- | --- | --- |
| "Saving..." | AddLabForm L312, AppointmentsTab L259 | "Saving" (no ellipsis) |
| "Lab results, imaging, appointments, and medical history" | page.tsx subtitle | keep, it answers the route's question |
| "No lab results yet" | LabsTab L520 | "No labs here yet. Import from myAH or upload a PDF." |
| "Add results manually or scan a photo of your lab report" | LabsTab L522 | merge into empty template hint |
| "No imaging studies yet" | ImagingTab L42 | "No imaging on file. New scans show up here once added." |
| "No appointments yet" | AppointmentsTab L330 | "No appointments booked. Add one when you have it scheduled." |
| "No timeline events yet" | TimelineTab L113 | "Your timeline is waiting for its first event." |
| "PACS viewer requires the local imaging server to be running." | ImagingTab L156 | keep; technical note is fine |
| "Critical" / "High" / "Low" flag pills with red/orange tints | LabsTab flagLabel | "Above range" / "Below range" / "Watch" with soft amber/blue, never saturated red |
| "Scan Photo" button | LabsTab | ok, but demote from sage-filled (already have Add Result as the one primary) |

## Fix plan

### Blockers (ship-stoppers)
- **B1. No search on labs.** Add a search input at the top of Labs tab that filters by `test_name` and category. Essential for the under-5-seconds test.
- **B2. Desktop layout.** Apply `.route-desktop-wide` (~820px) so the column stops rattling in a 1440px void. Split-pane is overkill for this dense flat list; wide reading width is right.
- **B3. Scarce Accent Rule.** Demote multiple sage elements. Keep sage for the single primary action per tab (Scan Photo on Labs, Add Appointment on Appointments, Add Event on Timeline). Everything else neutral.

### High
- **H1. Lab flag language.** Rename "Critical"/"High"/"Low" to softer "Above range"/"Below range"/"Watch" and remove red from lab pills entirely (blue for below, amber/soft-orange for above, no #EF4444). Keep the data clearly visible.
- **H2. Empty states.** Rewrite all four to use `.empty-state` with a Lucide icon and warm template.
- **H3. Tabular nums.** Add `className="tabular"` to all lab values, reference ranges, dates, appointment date chips, timeline dates.
- **H4. Microcopy.** "Saving..." -> "Saving". Section "Upcoming"/"Past" already use `.section-header`-style classes; keep them but reclass to `.section-header`.
- **H5. Interactive states.** Add Hover (`translateY(-1px)` or bg tint) + Press (`press-feedback`) to all cards/buttons.
- **H6. Category filter on Labs.** Add a horizontal chip row for lab categories (CBC, Iron Studies, Vitamins...) beneath the search.

### Medium
- **M1. Raw hex in TimelineTab (`#EF4444` for hospitalization)** -> use a design token or muted tone.
- **M2. Appointment card date chip** - demote from sage background to neutral elevated bg + sage text OR leave only the most-upcoming appointment with sage highlight.
- **M3. Out-of-range visual.** Use a left-border stripe (1-2px) rather than colored type to signal range break; softer.
- **M4. Numeric density.** Condense ref-range line into a single tight row with tabular nums.

### Polish
- **P1. Press-feedback animation** on tab pills and cards.
- **P2. Shimmer skeleton** for the lab list container (not applicable here because data arrives server-side, but good guard against flicker).
- **P3. Divider-dashes between dates** replace with tighter `.section-header` style uppercase date text left-aligned.

## Deferred (outside my lane)
- `AddEventForm` (lives in `src/components/timeline/`) uses `Loader2 animate-spin` and "Saving..." - cannot touch per contract rules.
- `PhotoLabScanner` (lives in `src/components/labs/`) - not touched.
- Global CSS additions (any) - not touched.
