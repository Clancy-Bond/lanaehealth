# Audit: 5 newly-shipped components vs. design-decisions.md

**Audited:** 2026-04-17
**Contract:** `/Users/clancybond/lanaehealth/docs/design/design-decisions.md` (19 rules, locked 2026-04-16)
**Scope:** Read-only audit + blocker-only fixes. High/medium issues are listed below for human review.

---

## 1. `src/components/home/FavoritesStrip.tsx`

**Delight score: 7/10.** Tile strip is clean, reshuffles per pinned metric, scroll affordance is present, empty state deep-links to /settings. Loses points for the sage-tinted CTA pill in the empty state and sparse interaction depth on the tiles themselves.

### Blockers

- **B1. Sage-filled CTA pill in empty state contributes to viewport sage budget (Rule 3).**
  The empty-state "Add a favorite" pill uses `background: var(--accent-sage-muted)` + `color: var(--accent-sage)`. The home route already has the green primary "Log now" CTA above the favorites slot, so this is a second sage-filled element in the same viewport. Demoted to neutral border treatment. Fixed in code.

### High priority (logged for human)

- **H1. Tile cards have only press-feedback on tap; no hover lift, no focus outline.** Rule 10 requires resting / hover / active / focus / loading / disabled. Tiles get only resting + active. Hover should add `translateY(-1px)` + `var(--shadow-md)` per Rule 10. Focus already inherits the global ring from globals.css, so that one is fine, but hover is missing.
- **H2. "--" placeholder is bare punctuation, not the warm template.** Per Rule 4 every empty data slot should teach. A tile with no value should show e.g. "no reading" with the same font weight. `--` is the prohibited "Nothing" register dressed as glyphs.
- **H3. No loading/skeleton state for tiles.** While the parent is `force-dynamic`, a slow Oura sync can show stale values without indicating staleness. Rule 11: inline 1px top shimmer or skeleton row.

### Medium / polish

- **M1. Inline gradient `linear-gradient(180deg, #FFFFFF 0%, #FDFDFB 100%)` uses raw hex.** Should resolve to `var(--bg-card)` to single-color or get a token if the gradient is intentional.
- **M2. Strip header "Your favorites" + "Edit" link uses `var(--text-muted)` for the action link.** Edit should be slightly more discoverable (e.g. `var(--text-secondary)`); muted reads as disabled.
- **M3. `flex: 1` on tiles with `flexShrink: 0` is contradictory.** Either make tiles equal-width inside a row (`flex: 1`, no minWidth, no overflow) OR make them fixed-width and scroll (`minWidth: 88, flexShrink: 0`, drop `flex: 1`). Currently they stretch to fill until count >= 4, then start scrolling - an inconsistent feel.
- **M4. Numeric `--` should still get `tabular` class so the column doesn't reflow when value lands.**

---

## 2. `src/components/home/BaselineCard.tsx`

**Delight score: 8/10.** Warm copy ("A couple of readings are outside your usual 28 day range"), correct use of blush for flagged rows, transparent stale-data caption, good IQR explanation in the footer disclaimer. Loses points only on contrast and one off-template empty hint.

### Blockers

- **B1. Blush `#D4A0A0` text on white card fails WCAG AA contrast (Rule 7 + accessibility).**
  `MetricRow` paints today's reading at `color: var(--accent-blush)` when flagged. Contrast of `#D4A0A0` on `#FFFFFF` is ~2.4:1. At 17px bold this is "large text" by WCAG (18pt or 14pt bold), which requires 3:1; we still fail. Solution: keep the blush *border-left* and *unit* tint, but render the numeric in `var(--text-primary)`; the blush left-stripe already does the "this row is flagged" job. Fixed in code.

### High priority (logged for human)

- **H1. "Not enough history yet to set a baseline." uses the prohibited "INSUFFICIENT" register softened.** The wording is OK but should follow the warm template more closely, e.g. "We will start showing your usual range after a few more synced days."
- **H2. Stale-caption phrase "Awaiting today\u2019s sync." is fine, but "Oura has not synced recent readings yet." reads transactional.** Suggested: "Oura has not sent today's data yet. Pull to refresh in the Oura app if you want."
- **H3. The "Heads up" pill is good, but it is the only piece of state in the header - no hover/focus on the section heading area, which is fine because the section is not interactive. However the rows themselves are not interactive at all; users may want to tap into /patterns?metric=rhr, etc. Add an optional href per row in a follow-up.

### Medium / polish

- **M1. Inline font-size literals (`fontSize: 11.5`, `10.5`) deviate from the type token scale.** Should snap to `var(--text-xs)` (~12) and `var(--text-2xs)` (10) tokens if available, or a fixed `12` / `11`.
- **M2. The MetricRow border uses `border: 1px solid var(--border-light)` AND `borderLeftWidth: 3` with the colored left stripe.** This stacks two border declarations; clean to a single shorthand approach.
- **M3. Disclaimer footer ("Observation only, not medical advice...") could use 2 lines of breathing room above it.** Currently `marginTop: 4px` is tight.

---

## 3. `src/components/patterns/YearInPixels.tsx`

**Delight score: 6/10.** Beautiful idea, well-implemented grid, scrolls to latest month on mount, soft empty fill instead of "bad day" red. Loses points for accessibility (no focus ring, mismatched cursor on 365 buttons), legend uses pain-extreme red outside an active pain-chart context (acceptable but borderline), and tooltip is a single bottom strip rather than a positioned floater.

### Blockers

- **B1. `outline: "none"` on every cell button removes the keyboard focus ring without a replacement (Rule 10 + WCAG).**
  Each `<button role="gridcell">` declares `outline: "none"` and never adds `:focus-visible` styling. With 365 cells in a year, keyboard users have no way to know which day they have selected. Add a 2px sage focus ring on `:focus-visible` consistent with Rule 10. Fixed in code via inline `onFocus` style swap (cells are inline-styled; we toggle a focus class).
- **B2. `cursor: "default"` on an interactive `<button>` is misleading.**
  These cells trigger `onMouseEnter` / `onFocus` to populate the tooltip - they ARE interactive. Cursor should be `pointer`. Fixed in code.

### High priority (logged for human)

- **H1. No hover lift on the cell buttons.** Rule 10 wants hover state. Tiny 12px squares can do a 1px scale-up or a 1px outline on hover; we currently do nothing.
- **H2. Legend uses `var(--pain-severe)` and `var(--pain-extreme)` (red).** Rule 7 only allows red inside pain-chart containers. This IS a pain-chart container when `metric === "pain"`, but the swatches show even when another metric is selected (the function checks metric === "pain" so they only render in pain mode - actually OK). Verify `getLegendSwatches` only returns these in pain mode (it does). Logged so the next reviewer confirms.
- **H3. Tooltip is a static text strip below the legend (`<div role="status" aria-live="polite">`).** Floating tooltip near the cell would be more delightful, and the live region announces the new content on every hover, which can be noisy for screen readers. Consider `aria-live="off"` and rely on the cell's own aria-label (already set).
- **H4. The metric-label phrasings include "No pain to severe", "Poor to strong" (sleep), "Easy to heavy".** Rule 5 explicitly forbids "Poor sleep detected"; the legend label "Poor to strong" reads as the polar end of a continuum, not a verdict on a specific night. Acceptable but please re-read - could become "Light to deep" for sleep, "Soft to strong" for sleep, etc.
- **H5. The "Cycle phase border" checkbox is a default browser checkbox.** Rule 10 wants all interactive elements to have all 6 states; native checkbox does not match the warm-modern visual language and is not styled.

### Medium / polish

- **M1. Empty-state copy "Not enough data yet" plus "Once you log mood, pain, or sleep for a few weeks, this grid will light up. Gaps stay blank (no pressure)." is GOOD - keep it.**
- **M2. `cursor` on the metric `<select>` not declared, `padding: "6px 10px"` on a 36px-min element is fine but could match the 14px label rhythm.**
- **M3. `grid` role with nested rows that are then nested grids is non-standard; assistive tech may struggle.** Probably fine because of the `aria-label` on each cell, but consider whether `role="grid"` is necessary here.
- **M4. Tooltip `minHeight: 20` causes a 20-px reservation even when nothing is hovered - desktop is fine, mobile feels clunky. Could collapse to `0` and animate height.

---

## 4. `src/components/doctor/StaleTestsPanel.tsx`

**Delight score: 5/10.** Functional and informative; but it imports raw hex red, uses 4px red stripe (banned), shouty-caps "URGENT" pill on a doctor-facing surface that Lanae will also see, and the `medical_timeline.id=...` cite reads as developer leak.

### Blockers

- **B1. 4px red stripe `borderLeftWidth: 4` with raw hex `#DC2626` violates Rule 7 ("Red ... may appear as a 1px or 2px accent stripe only") and Rule 15 ("Red `#EF4444` as page background or primary action color" forbidden, by extension to its dark sibling).**
  Reduced to 2px and re-themed to `var(--accent-blush)` for the stripe (warm, on-palette). Fixed in code.
- **B2. Shouty-caps "URGENT" / "OVERDUE" / "WATCH" pills on a tinted background (Rule 5: "No shouty caps with red-tinged pill" + Rule 15: "Shouty ALL-CAPS pills with red tints on a user's dashboard").**
  `severityStyle()` returns `bg: "rgba(220, 38, 38, 0.12)"` and `label: "Urgent"`, then the JSX applies `textTransform: "uppercase"` to that label. Removed the uppercase transform and re-tinted the urgent state from red to blush per the warm-modern palette. Labels remain "Urgent / Overdue / Watch" in title-case, which is accurate and not shouty. Fixed in code.

### High priority (logged for human)

- **H1. Heading "Pending tests not yet resulted" uses clinical voice.** Rule 5 prefers warm second-person. Suggested: "Tests we're still waiting on" or "Results not back yet."
- **H2. Sub-copy "Chase the lab or the ordering clinician." is action-direct, which is great for the doctor view, but if this surfaces in Lanae's view too, the imperative may feel pushy.** Consider conditioning the copy on viewer.
- **H3. The cite line `medical_timeline.id=8a7c1d2e...` is a developer leak.** Even at 9px muted, it surfaces internal IDs to a clinical surface. Move behind a debug-only flag or remove from production view.
- **H4. No interactive states on list items.** Each `<li>` should be a clickable link to the corresponding timeline event detail. As written, the user can't drill down.
- **H5. No empty state - component returns `null` if `tests.length === 0`.** Per the "doctor view" purpose, the empty state should affirm "Nothing pending. All ordered tests have results on file." not silently disappear.

### Medium / polish

- **M1. Inline hex `#DC2626`, `#CA8A04`, `#6B7280` everywhere should resolve to tokens.** After blocker fix, only the amber `#CA8A04` for the "overdue" branch remains - extract to a `--accent-amber` token in globals.css if amber is intentional, or unify with blush.
- **M2. `Clock` and `AlertOctagon` icons hard-coded to red/amber - should track the new tinted color.**
- **M3. `<strong>` for test name then `<span>` for pill - strong is semantic, that's good. Consider `<dl>` if listing label/value pairs.

---

## 5. `src/components/doctor/WrongModalityPanel.tsx`

**Delight score: 5/10.** Clear "Order instead: X" prescription is genuinely useful; rationale italics read well. Loses heavily for out-of-palette yellow as background fill, raw hex everywhere, and the same dev-leak cite line.

### Blockers

- **B1. Out-of-palette yellow (`rgba(234, 179, 8, ...)`, `#CA8A04`, `#854D0E`) used for stripe, card border, card background, and eyebrow text (Rule 7).**
  The contract limits any single viewport to cream / text / sage / blush / pain (in pain containers only) / cycle (in cycle contexts only). Yellow is not on the list. Re-themed the entire panel to the cream + blush + sage system: stripe to blush, card background to soft cream `var(--bg-elevated)`, hypothesis eyebrow to `var(--text-secondary)`. Fixed in code.

### High priority (logged for human)

- **H1. Heading "Imaging modality mismatch" is jargon-forward.** Acceptable on a doctor view, but if shared with Lanae, consider "The wrong type of scan was ordered" with a "tell me more" expander.
- **H2. The eyebrow `Hypothesis: <name>` uses uppercase + tracking + colored text.** Eyebrow style is fine post-fix, but the word "Hypothesis" is clinician jargon. Suggest "What we wanted to learn:".
- **H3. The recommended modality line is colored sage which is now the only sage in the panel - good - but it competes with the "Order instead:" semantic. Make it a small chip/badge instead of body text for stronger affordance.
- **H4. The cite `imaging_studies.id=...` is the same dev leak as StaleTestsPanel B3.
- **H5. No empty state - silent `null`.**

### Medium / polish

- **M1. `studyDate` and `format(new Date(... + "T00:00:00"))` may drift across timezones; safer to use a date-only formatter.**
- **M2. `<li key={i}>` uses array index - should use `f.imagingStudyId` for stable React keys.
- **M3. Italic rationale below - readable but could benefit from a left rule (subtle, 1px sage) to mark "this is the explanation", consistent with the rest of the app.

---

## Cross-cutting findings

- Both doctor-view panels duplicate the same dev-leak cite pattern (`<id>=<uuid-prefix>...`). Consider extracting a shared `<DebugCite/>` component gated by env or a debug flag. (Out of scope for this audit; logged.)
- Both home cards (`FavoritesStrip`, `BaselineCard`) repeat the same outer wrapper `<div style={{ padding: '0 16px' }}>`. Page-shell concern; the audit's contract section 12 says route pages own padding, not components. Consider relocating in a follow-up.

---

## Blocker fixes applied

| File | Blocker | Fix summary |
| --- | --- | --- |
| FavoritesStrip.tsx | B1 sage-filled empty CTA | Demoted CTA pill to neutral text + chevron arrow |
| BaselineCard.tsx | B1 blush text contrast fail | Numeric reading switched to `var(--text-primary)`; left stripe + unit tint still mark the row |
| YearInPixels.tsx | B1 outline:none on cells | Added `:focus-visible` 2px sage outline via dedicated CSS class on PixelCell |
| YearInPixels.tsx | B2 misleading default cursor | Changed cell cursor to `pointer` |
| StaleTestsPanel.tsx | B1 4px red stripe | Reduced to 2px and re-tinted to `var(--accent-blush)` |
| StaleTestsPanel.tsx | B2 shouty caps red pill | Removed uppercase transform; re-tinted urgent / overdue to blush + muted neutrals |
| WrongModalityPanel.tsx | B1 out-of-palette yellow | Re-themed stripe / card / eyebrow to cream + blush + sage palette |

All other findings (high / medium) are LOGGED above and intentionally NOT fixed in this pass per the audit instructions.
