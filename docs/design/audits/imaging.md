# /imaging — Design Audit

**Route:** `/imaging`
**Files:** `src/app/imaging/page.tsx`, `src/components/imaging/{ImagingViewerClient,ScanUploader}.tsx`
**Date:** 2026-04-17

## Purpose

`/imaging` is the route Lanae hits in two distinct contexts: (a) preparing for a doctor visit, when she needs a specific finding from a specific study (e.g. "CT Head, April 8, said no acute intracranial pathology"); (b) the deeper dive, where she pivots to the PACS DICOM viewer to show her doctor the actual slices. The route must let her locate a study in under 5 seconds, read the findings, and jump to the viewer without cognitive cost.

## First impression (all 3 breakpoints)

- **375 (mobile):** Header with back arrow, h1 "Imaging", 5 studies on file, Upload pill top-right. Two toggle pills "Reports" / "View PACS". A single horizontal row of 5 study chips in purple/blue/green (MRI, CT Scan, X-Ray, EKG). Below, five cards stacked vertically. Each card has a modality badge (colored), body part + date, CLINICAL INDICATION eyebrow, sometimes a FINDINGS block (tinted), and a FULL RADIOLOGY REPORT expand row. Bottom nav visible. Page reads clean but loud with competing hues.
- **768 (tablet):** Same single-column layout centered. Generous side whitespace but nothing else uses it.
- **1440 (desktop):** Mobile column centered in a 1440px viewport. Empty flanks. Exactly the §13 violation. The study chips wrap into a single line and feel lost.

## Visual hierarchy

- The h1 is a quiet 18px weight 600 sitting next to a tiny "5 studies on file" subline. That is not a route-hero.
- Modality pills (purple, blue, green, sage) compete for attention with each other and with the findings block background tints that mirror them. Four distinct hues active on one viewport. Against the Scarce Accent Rule (§3), this is a clear violation: two sage elements are on screen (Reports pill, back arrow/active state), plus three brand-unrelated hues (purple, blue, green).
- Findings blocks are a floating colored rectangle, but each rectangle is a different color. The eye never settles because nothing is the "one prominent thing" per viewport (§10, Oura principle).

## Clarity of purpose (can Lanae find CT Head findings in 5 seconds?)

**Borderline.** With only 5 studies the flat list works, but nothing about the UI teaches hierarchy. The study-type chip row at top is a filter in appearance (looks tappable) but actually non-interactive — it is only a summary. That is a usability trap. No search, no modality filter that actually works, no pinning. If this grows to 20+ studies this collapses.

## Consistency violations

1. **Purple MRI/EKG, blue CT, green XR** — four hues beyond palette (§7). Only sage and blush (and neutrals) are allowed in a LanaeHealth viewport. Keep the neutral card surface; communicate modality through a left-border accent stripe or a monochrome pill.
2. **`#5B9BD5` / `#8B5CF6` / `#06B6D4`** raw hex in `modalityMeta` — these are outside the palette entirely. Tokens only.
3. **Findings block uses tinted background per modality** — produces the same multi-hue effect on the card canvas. Normalize to a single cream-tinted background; keep the leading dot / icon only as subtle accent.
4. **Tab pills** ("Reports" / "View PACS") use bespoke inline `rgba(...)` backgrounds with per-tab color — PACS uses blue `#5B9BD5`. They should use `.pill` / `.pill-active` per the design system, with sage-only active state.
5. **Inline shadow formulas** — `boxShadow: 'var(--shadow-sm)'` is already a token (good), but all other elevations are none or inline. No other custom shadows found. ok.
6. **"View PACS"** — naming issue: user-facing should be "Viewer" or "DICOM Viewer" for consistency with product language. Keep "PACS" since she knows the term from doctor visits but lowercase "viewer". Rename to "Viewer" since Lanae refers to it as the slice viewer.
7. **Upload button missing 6 interactive states.** No hover shift, no pressed state, no loading state, no disabled state. The `onClick` toggles between resting and a "sage-tinted active" look but that is a toggle, not a state machine.
8. **"Back to Records" link** in empty state is a bare sage underline — no press-feedback, no hover.
9. **Findings dot uses `meta.color`** which is the off-palette modality color — again off-palette.
10. **Date strings** like "May 14, 2026" and "Apr 8, 2026" lack `tabular` nums. The chip row `"MRI - May 14, 2026"` lacks tabular nums too.
11. **EKG vital numerics** — the EKG findings string "Vent rate 68 BPM, PR 152ms, QRS 94ms, QT/QTc 411/427ms" is not rendered with tabular nums and those are precisely the kind of numbers the contract calls out (§9).
12. **`Loader2 animate-spin`** spinner inside ScanUploader (line 292). Violates §11 (no spinners). The text "Saving..." also violates §5 (no trailing ellipsis).
13. **"Study saved successfully."** — exclamation-free is good; language is fine. But can warm to "Saved. Your study is on file." per §5.
14. **Error pill** uses raw red `#DC5050` and red-tinted background. Soften to blush-tinted per §6/§7, since this is chronic-patient UI.
15. **Empty state** doesn't use `.empty-state` — uses a custom flex block, wrong icon size, copy `"No imaging studies"` / `"Imaging reports will appear here once studies are added to your records."` fails §4 template.
16. **`viewMode === 'pacs'` iframe** has hard-coded `#000` background (fine, the viewer is dark) but the transition to it is abrupt — no chrome that says "you are in viewer now."
17. **No press-feedback** on the tab pills, study cards, or the expand toggle row.
18. **`setTimeout(..., 1200)` + `window.location.reload()`** is a hard reload; could be softened but out of pure design scope.

## Delight factor

**5/10.** Content is clean, cards read well, the expandable report is a nice progressive-disclosure touch. But the palette salad (four modality hues) and the non-interactive chip row rob it of the calm-and-confident feel the design system promises. With color restraint and one primary action, this easily climbs to 8.

## Interactive states inventory

- **Tab pills** (Reports / View PACS): Rest + active. No hover, no press, no focus-visible accent (inherits global), no loading, no disabled. → 2/6
- **Upload button**: Rest + "open" toggle. No hover, no press, no loading, no disabled. → 2/6
- **Modality chip row** (summary): Non-interactive, so this is fine; but it looks tappable. Either make it a real filter or reduce its visual prominence so it reads as a summary only.
- **Study card**: No states. Should press-feedback + hover-lift so she knows the card is tappable. Currently only the internal expand button is interactive, which is misleading.
- **Expand toggle (Full Radiology Report row)**: Rest + expanded. No hover, no press, no focus. → 2/6
- **Back arrow**: Rest. No hover, no press. → 1/6
- **ScanUploader submit**: Rest + submitting (spinner, forbidden). No hover, no press, no proper fill-on-save, no disabled. → 2/6 (and wrong mechanism)

## Empty states inventory

- Studies empty (`studies.length === 0` branch): Custom flex block, `"No imaging studies"` title + `"Imaging reports will appear here once studies are added to your records."` hint + "Back to Records" link. Does NOT use `.empty-state` and fails the §4 template. The required string per the brief is: `"Your imaging reports will show up here once uploaded."`

## Microcopy audit

| String | Where | Fix |
| --- | --- | --- |
| "5 studies on file" | header subtitle | keep, numeric fine; wrap in `.tabular` |
| "View PACS" | tab pill | "Viewer" (sage when active) |
| "No imaging studies" | empty state title | "No imaging on file." |
| "Imaging reports will appear here once studies are added to your records." | empty hint | "Your imaging reports will show up here once uploaded." (per brief) |
| "Back to Records" | empty link | keep |
| "Saving..." | ScanUploader submit | "Saving" (no ellipsis, no spinner) |
| "Study saved successfully." | ScanUploader success | "Saved. Your study is on file." |
| "Failed to save study" | ScanUploader error fallback | "Something broke on my end. Try again?" |
| "Request failed ({status})" | ScanUploader error | "Something broke on my end. Try again?" |
| "Upload Imaging Study" | ScanUploader title | "Add an imaging study" |
| "Save Imaging Study" | ScanUploader submit | "Save study" |
| "Select..." | modality placeholder | "Choose a modality" |

## Fix plan

### Blocker

- **B1. Palette salad.** Replace per-modality hues with a single neutral card bg (`var(--bg-card)`), a 3px left-border accent stripe in a token-safe tint (sage for clinical/EKG, blush for GYN, neutral gray for the rest — keep accent stripes subtle, not saturated). Eliminate all raw hex in `modalityMeta`.
- **B2. Findings block bg.** Single cream-tinted background (`var(--bg-elevated)` or `rgba(107,144,128,0.06)`), not per-modality.
- **B3. Tab pills.** Apply `.pill` / `.pill-active` classes. One sage active state (the selected tab). No blue for PACS.
- **B4. Scarce Accent Rule.** Only ONE sage-filled element per viewport. The active tab is the sage one; the Upload button demotes to neutral pill; the back arrow uses `text-secondary`.
- **B5. Desktop layout.** Wrap main content in `.route-desktop-wide` so at 1440px the column stops rattling in void.
- **B6. Empty state.** Use `.empty-state` + `.empty-state__icon` + `.empty-state__title` + `.empty-state__hint`. Icon: `Image` from Lucide, 48-64px, sage 30% opacity. Title: `"No imaging on file."` Hint: `"Your imaging reports will show up here once uploaded."`

### High

- **H1. Tabular nums.** All dates, the "5 studies on file" count, and especially EKG vitals (BPM, PR ms, QRS ms, QT/QTc ms) get `className="tabular"` or `data-numeric`.
- **H2. Interactive states.** Every clickable element gets all 6 states:
  - `.pill` provides hover/active built-in; for study cards add `translateY(-1px)` + `var(--shadow-md)` on hover and `.press-feedback` on active.
  - Expand toggle: full-row `.press-feedback` + aria-expanded + keyboard focus.
  - Upload button: pill with press-feedback + proper disabled state.
- **H3. Remove spinner in ScanUploader.** Replace with fill-on-save pattern (accent fills left-to-right 300ms, checkmark appears). Copy to "Saving" (no ellipsis) then "Saved."
- **H4. Route hero.** Apply `.route-hero` class block at the top with eyebrow "Your imaging", title "Imaging", subtitle "<n> studies on file".
- **H5. Modality chip row.** Either (a) promote to a real filter (`.pill` row that filters the list) or (b) remove — because currently it lies to the user. Pick (a); it adds real value.
- **H6. Error pill.** Soften red. Use blush-tinted `rgba(212, 160, 160, 0.12)` bg, muted text, no saturated `#DC5050`.

### Medium

- **M1. PACS viewer chrome.** Small info bar above the iframe: "DICOM viewer — pinch/drag to navigate. Press ESC to exit." Gives context.
- **M2. Report text area.** Preserve the monospace but widen slightly on desktop and normalize line height.
- **M3. Card header spacing.** Currently 20px vertical padding (`py-4 px-5`). Move to `var(--space-4)` equivalents for consistency.
- **M4. Section separators.** Use `var(--space-6)` between the chip row and the first card; `var(--space-4)` between cards.

### Polish

- **P1. `.press-feedback`** everywhere tappable (card, pills, expand).
- **P2. Focus-visible** on the expand toggle row (not just the button).
- **P3. Date formatting** — unify formatDate and formatShortDate, using month-short for chips ("May 14, 2026") and month-long for card headers ("May 14, 2026" is fine).
- **P4. Progressive disclosure hint.** Chevron rotates 180° on expand (currently swaps Up/Down icons; smoother animation = chevron rotate `var(--duration-fast)`).

## Deferred (outside my lane)

- globals.css additions (none required; all tokens already exist).
- `/pacs.html` iframe content (not a page or component in this tree).
- BottomNav/AppShell chrome.

---

**Priority order for implementation:** B1→B6 first (palette + layout + empty state); H1→H6 next (numerics, states, spinner removal, hero); M/P polish last.
