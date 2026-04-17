# /import + /import/myah audit

**Purpose:** Give Lanae a friction-free path to pull her Adventist Health (myAH) records into LanaeHealth. The `/import/myah` route is a four-step wizard; `/import` should be a small chooser that routes her into the right flow.
**Files:** `src/app/import/page.tsx` (missing), `src/app/import/myah/page.tsx`, `src/components/import/MyAHImporter.tsx`, `src/components/import/UniversalImport.tsx`.

## First impression (375 / 768 / 1440)

- **375 (/import/myah):** Clean, readable. Header with green building icon is warm. Step indicator reads as four pips across the top with a compact sage "1" on the left, which is good, but inactive step numbers are sitting in `bg-elevated` circles with cream/gray text that is hard to see. The external-link chip for `mychart.adventisthealth.org` is present with an underline and icon. Four tappable option rows are a comfortable height. "Continue" disabled button is cream-on-cream and reads as unclickable, which is correct intent, but is visually indistinct from the cards above it.
- **768 (/import/myah):** Same mobile column, centered in the tablet frame. The route feels wide but the content still lives in a narrow 540px column with empty flanks.
- **1440 (/import/myah):** The 540px mobile column is marooned in the middle of a 1440px canvas. Violates §13 (Desktop layout rule). No split, no reading experience, no meta panel. The bottom nav dominates the bottom bar while a sea of cream sits beside the wizard.
- **1440 (/import):** Default Next.js 404 "This page could not be found." No brand voice, no guidance, no routing to the actual import flow. Any user who clicks the `/import` link from `QuickImportButton` lands here. Blocker.

## Visual hierarchy

- Step indicator, category cards, and external link all compete for a soft-sage pass. The only true primary is "Continue", which is correctly disabled until at least one category is selected.
- The green building icon is a pleasant touch; the sage used there is the same sage as the active step and the "Continue" button, so when Continue enables, three sage elements exist at once in the Select step. Under §3 Scarce Accent Rule, the building icon should be demoted to a neutral muted sage tint (or just monochrome text color) so "Continue" is the single full-sage primary.
- Each category card uses `accent-sage-muted` as a hover/selected background. That is within the muted color range, so it's fine; it does not conflict with the scarce-accent rule.

## Clarity of purpose

Route answers: "What do I want to pull in from myAH, and how?" The four-step wizard is a clear answer once you're on the page. The `/import` parent route doesn't answer anything because it 404s.

## Consistency violations (design-decisions.md)

1. **`/import` is a default Next.js 404** — no file exists at `src/app/import/page.tsx`. Violates §12 (Page shell contract). Blocker.
2. **Active step indicator is sage AND building icon is sage AND active-tab pill is sage (Step 2 mode switch)** — when Continue is enabled on Step 1, the sage count is acceptable (icon + indicator are decorative, not interactive), but on Step 2 three sage-filled elements coexist: the active step indicator, the Paste Text / Upload PDF pill, and the tab pill for the active category. §3 violation in Step 2+.
3. **Spinner in "Parsing..." and "Importing..." button states** — `Loader2 animate-spin` at line 793 and line 1076. §11 forbids spinners. Use fill-on-save or shimmer.
4. **"..." ellipsis in several strings** — "Parsing..." (793), "Importing..." (1076), "... and N more" (986), `.slice(0, 120) + "..."` in notes preview (975). §5/§15 forbids trailing "..." in UI.
5. **"Import Complete" + "Import successfully"** — §5 warmer voice. "Import complete" is OK, but "imported successfully" should drop "successfully" and drop the implicit exclamation tone.
6. **Review step "No records were found in the provided data" empty state** — §4 template violation. Should be warmer, imperative next-step.
7. **"... and N more" preview pagination** — trailing "..." is the specific form §5 rules out.
8. **Shouty button labels with action verbs fine (Continue, Parse Data, Import N Records, View Records, Import More Data)** — no caps violations.
9. **Tabular numerics missing** — step indicator numbers (1, 2, 3, 4), badge "N records" pill, "N imported" pill, KB size, preview counts — §9 violation.
10. **Inline shadow formulas** — Review card uses `boxShadow: "var(--shadow-sm)"` which is correct; I don't see raw rgba shadow formulas in this component, so §8 mostly passes.
11. **Interactive states missing** — category cards, tab pills, mode-switch pills, Continue, Back, Parse Data, Import, View Records, Import More Data all lack explicit press-feedback. Only global `focus-visible` applies. §10 violation.
12. **No desktop-wide container** — main page wrapper hard-codes `maxWidth: 540, margin: "0 auto"`. Should lift to `.route-desktop-wide` for reading width at ≥1024px. §13 violation.
13. **Inline red error color** `var(--text-error, #e55)` — fallback `#e55` is a bright red, fine as a 2px accent but used as text color here. Per §7 red is allowed as accent stripe only. Swap to a sage-tinted warning or the cream-bg + blush-border pattern used elsewhere.
14. **Copy: "Tap to select a PDF file"** — fine. "Tap to change" — fine.
15. **Copy: "In myAH, go to Test Results..."** — the ". Select the results..." reads naturally but voice rule 5 prefers "Then" over ". " when chaining; acceptable as is, keep.
16. **Toggleable step revisit** — user reports this as an intent: tapping steps 1, 2, or 3 when they are complete should revisit them. Currently the step indicator is purely visual; no click handler. Add press-feedback + click to navigate when `isDone`.
17. **External link** — present, has underline + icon, fine. Keep.
18. **No em dashes** in source strings (good; I grepped).

## Delight factor: 5/10 — Rationale

The wizard's bones are fine: four clear steps, contextual helper text for each category, a two-mode (paste/upload) entry, and a review preview. But the details betray it: a blocker 404 at the parent route, a spinner in the parsing/importing button, trailing "...", a cream-on-cream disabled CTA, and a mobile column lost in desktop whitespace. The ingredients are right; the finish is wrong. A delightful import would clearly name the primary action at every step, fill the button when submitting, reframe empty review as instructive, and give desktop something other than empty flanks.

## Interactive states inventory

| Element | Rest | Hover | Active | Focus | Loading | Disabled |
| --- | --- | --- | --- | --- | --- | --- |
| Category row label | Y | partial (bg shift on checked) | N | label/global | N | N |
| Continue button | Y | N | N | global | N | Y (opacity 0.6, cream bg) |
| Paste Text / Upload PDF mode pill | Y | N | N | global | N | N |
| Category tab pill | Y | N | N | global | N | N |
| Textarea | Y | Y | N | global | N | N |
| File drop area | Y | N | N | global | N | N |
| Back (step 2/3) | Y | N | N | global | N | N |
| Parse Data | Y | N | N | global | Spinner (violation) | Y (opacity 0.6) |
| Import N Records | Y | N | N | global | Spinner (violation) | Y (opacity 0.6) |
| Step indicator pip | static | - | - | - | - | - |
| "Go back and try again" link | Y | N | N | global | N | N |
| View Records / Import More Data | Y | N | N | global | N | N |

## Empty states inventory

| Context | Current | Needs |
| --- | --- | --- |
| Review step, no records parsed | "No records were found in the provided data" | §4 warm template rewrite |
| Upload mode, no file yet | "Tap to select a PDF file / PDF format from myAH export" | Keep (neutral, directive) |

## Microcopy audit

| Where | Old | New |
| --- | --- | --- |
| Parse button loading | `Parsing...` | `Parsing` with fill animation |
| Import button loading | `Importing...` | `Importing` with fill animation |
| Preview overflow | `... and N more` | `plus N more` |
| Notes preview truncation | `<content>...` | `<content>` + length cap, drop trailing dots |
| Review empty | `No records were found in the provided data` | `Nothing to review yet. Go back and paste or upload your data.` |
| Done heading subline | `N record(s) imported successfully` | `N record(s) saved to your records` |
| "Import More Data" | OK | keep |
| `/import` new landing | (404) | "Bring in your health data." intro + single big card to myAH + placeholder line for future sources |

## Fix plan

### Blockers
- Create `src/app/import/page.tsx` as a landing page (either `redirect('/import/myah')` or a small chooser with a tappable card). Fix 404.
- Replace both parse/import spinners with fill-on-save progress (or a 1px top shimmer on the card). §11.
- Remove "..." from "Parsing...", "Importing...", "... and N more", notes preview ellipsis. §5/§15.

### High
- Hook step-indicator pips to become clickable when `isDone` (press-feedback, navigate to that step). Improves revisit flow.
- Demote building-icon sage to secondary text color so Continue is the single sage primary in Step 1.
- Add `.route-desktop-wide` container for ≥1024px reading width.
- Add `.press-feedback` to every interactive element (cards, pills, buttons, tab pills).
- Add `.tabular` to step numbers, record count badges, imported counts, KB size.

### Medium
- Review empty-state rewrite (template §4).
- Swap inline error color `#e55` for a cream-bg + blush-border (or text-primary with left-border blush accent).
- Loading language everywhere: no trailing dots, no spinner icons.
- Active-step hover: subtle sage ring, not a filled bg.

### Polish
- Center the single sage accent per viewport. On Step 2, if mode-switch pill is sage, the category tab pill should be muted; or vice versa. Use a 2px sage underline for the active tab and reserve the sage fill for the single primary action of the viewport.
- Use the shared file `.skeleton` class when data is pending on Review step instead of empty-sentence fallback.
- Expose step click as keyboard-accessible with `role="button"` + space/enter.
