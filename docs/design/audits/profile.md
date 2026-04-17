# /profile — Design Audit

**Route:** `/profile`
**Files:** `src/app/profile/page.tsx`, `src/components/profile/{ProfileClient,EditableList}.tsx`
**Date:** 2026-04-17

## Purpose

A single place Lanae owns her medical identity: personal info, confirmed diagnoses, suspected conditions, medications, supplements, allergies, family history, and her free-text medical story. The route answers "what do I want my doctor to know about me in 30 seconds?" Everything else (labs, imaging, timeline) lives on /records or /timeline. This page is the handoff document.

## First impression (all 3 breakpoints)

- **375 (mobile):** Eight vertical section cards, each with an icon chip, a title, content list, and an outlined "Edit" button with a pencil. Pleasant rhythm but long scroll; Family History and Medical Story hang below the fold even on a tall phone. Two sage-filled edit buttons visible at once on scroll. Confirmed Diagnoses and Family History each have 4-6 bulleted items with parenthetical detail inline at the same visual weight as the primary diagnosis.
- **768 (tablet):** Identical single-column centered layout. Extra horizontal room is wasted.
- **1440 (desktop):** Mobile column parked in the middle of a 1440 viewport. Roughly 800px of empty cream on each flank. This is the pattern §13 forbids. Medical Story — which deserves a reading-width column — is constrained to 640px and half-empty.

## Visual hierarchy

- The h1 reads correctly. Sections have a consistent card treatment (cream bg, 1px border, shadow-sm). The icon chip + title pattern works.
- Within each list, parenthetical details ride at the same font size / weight / color as the primary item. "Iron deficiency without anemia (ferritin as low as 10 ng/mL)" renders as one flat sentence — the ferritin reference and units compete with the diagnosis label instead of supporting it.
- Scarce Accent Rule violated. Every section card has a sage outlined Edit button. Eight section cards → eight sage-rimmed edits in one viewport. On scroll this is amplified. Also: every bullet leads with a 1.5px sage dot. Section icon chips are muted-sage. The count of sage pixels per viewport is high, which dilutes the signal the one true primary (Save in edit mode) should own.
- Info density is imbalanced: Personal Info has seven fields in a 2-col grid (good); Allergies has "None documented" as the only content then a full Edit button (wasteful).

## Clarity of purpose (can Lanae hand this page to a new doctor in 30 seconds?)

Partially. The content is there, but the hierarchy does not surface what is clinically most important: confirmed diagnoses and active medications. Family History and Medical Story deserve to collapse by default so the visit-ready content stays above the fold on first load.

## Consistency violations

1. Inline shadow `boxShadow: "var(--shadow-sm)"` in SectionCard (already correct token, not a raw formula), but the border/radius are inlined rather than delegated to the `.card` class. The `.card` class already handles shadow; the inline token is redundant but not forbidden.
2. Eight sage-tinted Edit buttons per viewport violates §3. In read-mode these should be neutral-ghost buttons; only the Save button in the currently-edited section earns sage fill. EditableList uses a plain sage-text Edit button (no border, no background), which is better, but PersonalInfoEditor and MedicationsEditor use a full sage-muted background + sage border on the Edit button, which reads as primary.
3. "None documented" empty voice (§4) used in EditableList for Allergies, Medications, Supplements, Family History. Not a warm sentence; no next-action hint.
4. "No suspected conditions" / "No diagnoses documented" / "No family history documented" — same flat style.
5. Ellipsis `Saving...` in PersonalInfoEditor (L251), MedicationsEditor (L497), EditableList (L187), MedicalStoryEditor (L608). Violates §5.
6. Placeholder in Medical Story textarea: `"Tell your medical story in your own words. This context helps your AI assistant understand your journey and prepares better doctor visit summaries. Include things like: when symptoms started, what triggered them, how they've progressed, what treatments you've tried, what doctors have said, and what you're hoping to find out next."` — long and includes apostrophes but no ellipsis, so passes letter-of-§5; however the brief asks for a warm, short placeholder.
7. Diagnosis hyphen separators: "Endometriosis - suspected: painful heavy clotty periods; no formal diagnosis" uses a plain hyphen ` - ` flanked by spaces. Not an em dash (§15 passes), but visually could be a colon or two clauses for readability. Verified not em dash.
8. Parenthetical detail in diagnoses ("(ferritin as low as 10 ng/mL)") reads at primary weight. Should be demoted to secondary color / smaller size.
9. Age, Height cm, Weight kg values render as plain `<p>` without `tabular`. Violates §9.
10. Interactive states: Edit buttons have no Hover, no Press, no Focus (relies on global focus-visible), no Loading (never fires async), no Disabled. Save buttons have a hand-rolled opacity-0.6 "Saving..." instead of a Loading state with shimmer / fill. No press-feedback on cards or buttons.
11. Desktop layout is the centered mobile column — forbidden by §13.
12. All eight section cards are always expanded. Family History and Medical Story are less-frequently-edited but occupy the same visual real estate as active Medications. Progressive disclosure (§10 of findings, Oura pattern) would ask the long sections to collapse by default.
13. `.press-feedback` utility exists but is unused on any tappable element in this route.
14. Bullet list dots in EditableList (1.5px sage circles) add eight to ten more sage pixels per viewport. Switch to neutral `--text-muted` or `--border` dots; reserve sage for the one true accent.

## Delight factor

**5/10.** The section card rhythm is pleasant; the icon chips are friendly. Missing: any sense of completion (would love a subtle "X of 8 sections filled" chip at the top), no progressive disclosure, no desktop richness, and the everything-expanded layout reads as a form rather than a patient profile.

## Interactive states inventory

- Personal Info Edit button: Rest/active-edit toggle only. No Hover. No Press. No Loading (Edit is synchronous).
- Personal Info Save button: Rest + disabled-opacity (during save). No Loading visual, no Hover, no Press.
- EditableList Edit (text-only sage): Rest only.
- EditableList Save: Rest + disabled-opacity. No fill-on-save.
- Remove X buttons on list items: Rest only. No Hover (should show blush tint), no Press.
- Plus button in EditableList: Rest + disabled variant. No Hover lift.
- Medical Story textarea: Rest only. No visible Focus state (relies on global focus-visible).
- Section cards: Rest only. No Hover.

## Empty states inventory

- Diagnoses: `"No diagnoses documented"` italic muted — no icon, no template.
- Suspected: `"No suspected conditions"` — same.
- Medications: `"None documented"` — same.
- Supplements: `"No supplements documented"` — same.
- Allergies: `"None documented"` — same.
- Family History: `"No family history documented"` — same.

All six fail the warm `.empty-state` template. The brief calls out specific warmer copy for Medications and Allergies.

## Microcopy audit

| String | Where | Fix |
| --- | --- | --- |
| "Saving..." | PersonalInfoEditor L251, MedicationsEditor L497, EditableList L187, MedicalStoryEditor L608 | "Saving" (no ellipsis) |
| "None documented" (Medications) | EditableList emptyLabel | "No medications on file. Add one to share with your doctor." |
| "None documented" (Allergies) | EditableList emptyLabel | "No known allergies recorded. Tap Edit to add any." |
| "No diagnoses documented" | EditableList emptyLabel | "No diagnoses here yet. Add confirmed ones so your doctor sees them first." |
| "No suspected conditions" | EditableList emptyLabel | "Nothing suspected yet. Add a hunch or a doctor's comment here." |
| "No supplements documented" | EditableList emptyLabel | "No supplements on file. Add the ones you take regularly." |
| "No family history documented" | EditableList emptyLabel | "No family history yet. Add relatives' conditions you think matter." |
| "Tell your medical story in your own words. This context..." (long placeholder) | MedicalStoryEditor L586 | "Write in your own words." or "Tell your story." (short, warm, no ellipsis) |
| "This is your medical story in your own words. Share context that does not fit into structured fields." | MedicalStoryEditor description L580 | Keep; tighten to "Write what doesn't fit into the structured fields." |
| "Your complete medical profile, editable anytime" | page.tsx subtitle | Keep, it answers the route's question. |

## Fix plan

### Blockers (ship-stoppers)

- **B1. No desktop layout.** Wrap the route container in `.route-desktop-split` at 1024+ so Personal Info + editable sections live on the left and the Medical Story textarea lives on the right reading panel. Or, as simpler fallback, `.route-desktop-wide` to widen to 820px.
- **B2. Scarce Accent Rule violated.** Demote all section-level Edit buttons to neutral ghost (transparent, secondary-text, subtle border) so the single sage primary per viewport is the active Save button during edit.

### High

- **H1. Ellipsis strings.** Replace four occurrences of "Saving..." with "Saving".
- **H2. Warm empty states.** Replace six "None documented" variants with the warm sentences above.
- **H3. Progressive disclosure.** Collapse Family History and Medical Story by default (tappable card header toggles expanded state). Other six remain expanded.
- **H4. Parenthetical demotion.** In EditableList, when an item contains ` (` split into primary + secondary spans so the parenthetical reads at --text-secondary and slightly smaller.
- **H5. Tabular numerics.** Add `className="tabular"` to Personal Info values (age, height_cm, weight_kg).

### Medium

- **M1. All 6 interactive states** on every Edit button, Save button, remove X, plus button: Hover (bg tint shift), Press (`.press-feedback`), Focus (global), Loading (fill-on-save or opacity), Disabled (opacity 0.5).
- **M2. Medical Story placeholder.** Replace long placeholder with "Write in your own words.". Keep existing description above the textarea as a hint; tighten if desired.
- **M3. Bullet dot color.** Use `--text-muted` or `--border` for list bullet dots instead of sage.
- **M4. Remove button hover.** Show blush tint on hover to signal destructive intent.

### Polish

- **P1. Section completion chip.** Small "7 of 8 filled" chip above the first section.
- **P2. `.press-feedback` class** on section cards so they feel physical when tapped in collapsed state.
- **P3. Tight the description above Medical Story textarea.

## Deferred (out of lane)

- Cannot edit `globals.css`, `BottomNav.tsx`, `AppShell.tsx`. These utility tokens are already present and usable from component CSS classes.
- `/api/profile` and `/api/narrative` are out of lane; no save-path changes here.
