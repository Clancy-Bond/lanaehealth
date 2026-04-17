# /doctor — Design Audit

**Audited:** 2026-04-16
**Scope:** `src/app/doctor/page.tsx` + `src/components/doctor/*`
**Viewports:** 375, 768, 1440

## Purpose

Clinical "Doctor Mode" surface. Intended to be opened in front of a physician during a visit (PCP, OB/GYN, cardiology) to surface a digestible medical snapshot: active concerns, latest vitals, trending labs, imaging, hypotheses, and what to discuss. Also doubles as a print/PDF-exportable brief the patient can hand off.

## First impression

The page is **very long** (30+ screen-heights on 1440px) and centered in a 800px column. Information is correctly dense but ordering is heavy: SpecialistToggle, TalkingPoints, SinceLastVisit, Hypotheses, Appointments, ExecutiveSummary, DataFindings (charts + correlations + imaging), QuickTimeline, WeeklyNarrative. The toggle and action buttons sit at top; sticky header with Print / Copy / PDF / Clinical Report is helpful. A physician could find the key talking points in 10-20 seconds; deeper data requires scrolling. The 1440 viewport wastes enormous horizontal space — no split layout.

## Visual hierarchy

- Section headers (`h2`) use sage 4x20 left tick pattern, good recognition. Consistent across sections.
- However, TalkingPoints + HypothesesPanel + SinceLastVisit + WeeklyNarrative use a **different** header pattern (icon + h2 inline in card) — breaking the sage-tick rhythm.
- Vitals cards use background color coding (sage/gold/red) that is legible but noisy on a cream page.
- Labs table is cleanly tabular. Lab trend charts get proper reference-range shading.

## Clarity of purpose

Clear for doctors: "What to Tell the Doctor" is a strong opener. The opening italic line in ExecutiveSummary (specialist framing) is helpful. Less clear: the distinction between `Presenting Complaints` + `Active concern` (TalkingPoints) + `Working Hypotheses` — some overlap. Acceptable for clinical, but user-facing (Lanae-facing) variant needs to not feel alarming.

## Consistency violations

1. **Two sage filled buttons** in the header at 1440 (Print/PDF sage-filled AND Clinical Report sage-filled) — violates Scarce Accent rule. Copy and PDF-text are outlined (good); the two filled sage buttons both anchor equally.
2. **Inline shadow formulas**: `DataFindings.tsx` line 132 `boxShadow: "0 4px 12px rgba(0,0,0,0.08)"` on tooltip — must use `var(--shadow-md)`.
3. **Em dash** in `PostVisitForm.tsx` line 135 (`` — ``).
4. **"..."** in: `PostVisitForm.tsx:101` ("Saving..."), `PostVisitForm.tsx:160` (placeholder), `QuickTimeline.tsx:206` (description truncation), `WeeklyNarrative.tsx:93` ("Regenerating..."), `WeeklyNarrative.tsx:99` ("Loading..."), and `WeeklyNarrative.tsx:136` copy ("Loading...").
5. **Tabular nums** missing: Executive Summary vital cards, abnormal labs table (has font-mono for value only), menstrual status numerics, date columns, `n=X | r=Y` correlation labels.
6. **"Active problems"** / **"Active concern"** copy: use clinical term `Presenting Complaints` or `Current concerns` per design rule #5. Current "Active concern" in TalkingPoints.tsx is softer — keep but ensure ExecutiveSummary label.
7. **SpecialistToggle buttons** use bare `transition: "all 0.15s ease"` instead of tokens.
8. **Empty states** use bare text:
   - `ExecutiveSummary`: "No active problems documented", "None documented", "None documented (NKDA)", "All recent labs within normal range" — not bad; acceptable clinical terse, but should be softened/templated.
   - `DataFindings` correlations: "No correlations found yet" with "Tap 'Analyze Patterns' in Settings" — close to the template already.
   - `QuickTimeline`: "No key medical events recorded" — needs template.
   - `SinceLastVisit`: "No prior appointment on file. This is baseline." — already good.
9. **Colored highlights**: cycle block uses blush rgba(212,96,90) — fine. LabFlagBadge uses `#DC2626` for critical — saturated red for TEXT is OK but only used as a tiny badge. No page-background red present. Good.
10. **Header actions 4 buttons wide** on 1440 — Print, Copy, PDF, Clinical Report — a lot. Could collapse, but since the page is print-focused for doctors we keep all four. Ensure each has clear labels (they do).

## Delight factor

**6/10**

Positives: specialist toggle is genuinely useful, hypotheses panel with single most-uncertainty-reducing test is a sharp idea, lab trend charts with reference bands read well, "Since last visit" diff is a great frame, sticky header always accessible.

Drags: wasted horizontal space at 1440, two competing sage CTAs, inline shadow, a few "..." and spinners, no press-feedback on tappable elements, `Loading...` text, some cards don't flow well (WeeklyNarrative feels afterthought).

## Interactive states inventory

- Header buttons (Print, Copy, PDF, Clinical Report): no hover/active/focus/press-feedback defined. Copy button toggles state on success (good).
- SpecialistToggle tab buttons: no hover/active feedback beyond the selected state.
- WeeklyNarrative Refresh/Generate button: has disabled/wait state, no press.
- Lab trend chart: recharts dots have activeDot, tooltip — decent.

## Empty states inventory

| Section | Current | Treatment needed |
| --- | --- | --- |
| Presenting Complaints | "No active problems documented" | Template: "All clear. Current concerns will show up here." |
| Current Medications | "None documented" | "No active medications. Add from Profile." |
| Supplements | "None documented" | "No supplements on file." |
| Allergies | "None documented (NKDA)" | Keep NKDA (clinical), soften prefix |
| Abnormal labs | "All recent labs within normal range" | Acceptable but warm it |
| Correlations | "No correlations found yet" / "Tap 'Analyze Patterns'..." | Apply empty-state template |
| Imaging | hidden if 0 | (no change needed) |
| Timeline | "No key medical events recorded" | Template |
| SinceLastVisit no prior | "No prior appointment on file. This is baseline." | Keep |
| Appointments | (hidden if 0) | (no change needed) |

## Microcopy audit

- "Saving..." → "Saving"
- "Regenerating..." → "Regenerating"
- "Loading..." → "One moment, pulling your story"
- "No narrative cached. Click Generate to produce..." → OK but make warmer
- "(stale, consider refreshing)" — acceptable
- "+N more. See full brief for details." — OK
- "--declining despite treatment" uses double-dash as em-dash substitute: acceptable per project rule (we avoid em dashes)
- description slice + "..." → drop trailing ellipsis or use single char glyph pattern without "..."; swap to no-ellipsis truncation

## Fix plan

### Blockers
- B1. Em dash in `PostVisitForm.tsx` line 135.
- B2. "..." in UI strings (PostVisitForm, QuickTimeline, WeeklyNarrative).
- B3. Inline shadow formula in `DataFindings.tsx` tooltip.
- B4. "Loading..." in WeeklyNarrative (twice).
- B5. Two sage-filled buttons in header (Print / PDF and Clinical Report). Demote Print to outlined or demote Clinical Report.

### High
- H1. Missing `tabular` / `data-numeric` on vital cards, labs table values+dates, correlation `n=` `r=`, menstrual numerics, cycle day/length values, SinceLastVisit date cites.
- H2. `1440` desktop: add `.route-desktop-wide` OR split into 2-column for `>=1024px`. The page is clinical-summary dense; widen reading column to ~860px and float the WeeklyNarrative + Timeline into a right rail.
- H3. Empty-state template for: Presenting Complaints, Current Medications, Supplements, Correlations (no data), QuickTimeline (no data).
- H4. Press-feedback on all tappable elements: header buttons, SpecialistToggle tabs, WeeklyNarrative refresh.

### Medium
- M1. Softer language: "No correlations found yet" → empty-state format.
- M2. Transitions using tokens `var(--ease-standard)` + `var(--duration-*)` instead of `0.15s ease`.
- M3. SpecialistToggle buttons get hover feedback (background tint on not-active).
- M4. Ensure PDF generation buttons have aria-labels (they already have `title`).

### Polish
- P1. Replace `Loading...` block render with `.skeleton` or `.shimmer-bar`.
- P2. WeeklyNarrative Refresh button: disable-only state; swap `Regenerating...` for `Regenerating` with shimmer edge.
- P3. QuickTimeline truncation: drop trailing `"..."` glyph; use CSS line-clamp or simple truncation without ellipsis.
- P4. Header buttons: unify styling (all outlined sage, one sage-filled accent only).
- P5. SpecialistToggle: transition token.
