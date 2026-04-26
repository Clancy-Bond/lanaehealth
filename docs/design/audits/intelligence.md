# /intelligence - Design Audit

**Route:** `/intelligence`
**Files:** `src/app/intelligence/page.tsx`, `src/components/intelligence/IntelligenceDashboard.tsx`
**Date:** 2026-04-16

## Purpose

The "what the AI knows" dashboard. Answers one question: "Given everything logged, what does the system believe about Lanae's health right now, and what can a doctor do with it?" It surfaces cycle phase, calorie/macro target, exercise capacity, orthostatic trend, and offers one-tap downloads of specialist-ready condition reports. It is the bridge between raw logs and clinical utility.

## First impression (all 3 breakpoints)

- **375 (mobile):** Four big tinted cards stacked. Each card bold, each card shouts its status pill in ALL-CAPS (HIGH, LOW, RECUMBENT, INSUFFICIENT). The Cycle card has a literal `--` glyph in body copy ("Cycle day 51 -- this cycle is longer than typical..."), which violates the em-dash rule and looks like broken ASCII.
- **768 (tablet):** Same mobile column, just wider. Nothing exploits the horizontal space. Vitals card is essentially empty (just one "Recommendation" row in the middle of a vast white card) because orthostatic data is sparse.
- **1440 (desktop):** Classic flank-waste pattern: narrow 640-ish column in a 1440 viewport. Cards look undersized and lonely. §13 violated.

## Visual hierarchy

- The h1 is present but not using `.page-title`. Instead a custom sparkle SVG + 26px heading.
- Every card has the same weight and tone. Because the first four are all tinted sage/cream with identical pill treatment, nothing stands out as "the primary thing to pay attention to." The Cycle card is the most important (informs 3 other cards) but reads at the same visual level as Exercise Capacity.
- Confidence pills (HIGH/LOW/INSUFFICIENT/RECUMBENT) have no legend. HIGH next to a cycle phase looks like a red-flag severity badge. LOW next to a calorie target looks like a failure grade. The badges are overloaded and unkeyed.

## Clarity of purpose

Mixed. If Lanae opens this expecting "what does the AI think today?", the four cards deliver. But the interpretation burden is on her: she has to know that HIGH means high confidence (not high severity), that RECUMBENT is the Levine protocol progression level, and that "0 / 120 min" is a weekly capacity ratio (not a failing grade). A patient with brain fog reading this during a tough stretch will feel judged.

## Consistency violations

1. **Em-dash via double hyphen.** Body copy `"Cycle day 51 -- this cycle is longer than typical (35+ days)."` renders two hyphens which read as an em dash. Violates §15 and the project-wide no-em-dash rule. Appears inside `flags[].message` from the API but surfaces in this component's `rows`.
2. **Shouty ALL-CAPS pills on a chronic-illness dashboard.** HIGH, LOW, INSUFFICIENT, RECUMBENT all rendered with uppercase + letter-spacing + filled backgrounds. Violates §5 (shouty caps with red/severity tints). INSUFFICIENT is especially harsh for data sparsity (§6).
3. **Confidence pills overloaded with status color.** The pill uses `colors.border` as bg and white text, so Cycle card's "HIGH" renders in sage (looks like an alert). Confidence and severity share a visual channel.
4. **Inline shadow formulas / inline transforms on hover.** `onMouseEnter` sets `boxShadow: '0 4px 12px rgba(107, 144, 128, 0.12)'` directly in condition report buttons (line 382). Should use `var(--shadow-md)` per §8.
5. **Inline hover state with JS** on both condition report buttons and deeper-analysis links. Heavy, not composable, and can't be interrupted by press-feedback. Should be CSS-class driven.
6. **Scarce Accent Rule.** Every card uses sage (muted bg, sage text, sage border). Plus the deeper-analysis "Doctor Mode" link is sage-filled. Plus the download icons are sage. Plus the h1 sparkle is sage. Many sages per viewport. §3 violated.
7. **No tabular nums.** Day 51, 1943 kcal, 104g / 54g / 260g, +58 bpm, 0 / 120 min - none carry `.tabular` class. §9 violated.
8. **Raw hex status colors** (`#FFF3E0`, `#FFE082`, `#E65100`, `#FFEBEE`, `#EF9A9A`, `#C62828`) in `STATUS_COLORS` map. §7 warns red is forbidden as bg; `#FFEBEE` is a pink-red card background. Keep critical states subtle.
9. **No `.page-title` class** on the h1; a bespoke 26px treatment is used instead.
10. **No `.press-feedback`** on any tappable element. `active:scale-[0.98]` is applied to the condition buttons but not to the deeper-analysis links. §10 requires consistent press feedback.
11. **Desktop uses centered 680px mobile layout** in a 1440 viewport. §13 violated. The page either needs `.route-desktop-wide` (820px) or `.route-desktop-split`.

## Delight factor

**5/10.** The cards are clean, the Intel-card concept is sound, and the download buttons already have chevron/download affordances. But there's no rhythm of discovery, no sense of "one primary thing per screen" (§10 progressive disclosure), no encouragement tone for a patient whose body is hard to predict. The RECUMBENT/INSUFFICIENT labels sap warmth.

## Interactive states inventory

- **Intel card:** resting + hover-shadow only. No press, no focus (not focusable; cards are static). OK since cards aren't interactive, but treating the whole card as a tap target would be a big win.
- **Condition report button:** resting + inline-JS hover + `active:scale-[0.98]` + focus-visible ring. Missing: loading (during download), disabled. Inline hover state is not consistent with press-feedback class approach.
- **Deeper-analysis link:** resting + inline-JS hover + `active:scale-[0.98]` + focus-visible ring. Missing: press-feedback utility use; loading; disabled (N/A).
- **Download icon in button:** decorative only; inherits button state. OK.

## Empty states inventory

- Full-dashboard empty (no cycle/nutrition/exercise/vitals) uses a flat `<p>` with "Keep logging your daily health data..." - misses `.empty-state` template, no icon, no sage tint.
- Vitals card empty-ish state: returns a card anyway, with "Recommendation" row only. When `thirtyDayTrend.totalTests === 0`, the subtitle pill reads "INSUFFICIENT" which is the worst possible label for "we need more data." Should use the warm microcopy template.
- Exercise capacity hidden when `estimatedMinutes === 0` (component returns null for the whole card). Silent disappearance is confusing.

## Microcopy audit

| String | Where | Fix |
| --- | --- | --- |
| `"-- this cycle is longer than typical"` in long-cycle flag | surfaces in Cycle card `rows` via `flag.message` | "Cycle day 51 (longer than the typical 28-day cycle)." Rewrite inside the rendering layer to strip/replace the `--`. |
| `"HIGH" / "LOW" / "MODERATE"` confidence pill | IntelCard `subtitle` | Soften: "High confidence" etc, sentence case, no filled background; render as unobtrusive text row ("Confidence: high") instead of a shouty pill. |
| `"INSUFFICIENT"` pill on Vitals | IntelCard `subtitle` = `deltaDirection` | "Needs more data" per §6. Not a red/amber pill. |
| `"RECUMBENT"` pill on Exercise | IntelCard `subtitle` = `positionProgression.currentLevel` | "Paced activity" or "Gentle movement" - patient-friendly. |
| `"Log orthostatic vitals (supine then standing HR) at least 3 times per week for trend analysis."` | Vitals `rows` "Recommendation" | Split into 2 sentences: "Log supine then standing heart rate a few times a week. After three entries, a trend will appear here." |
| `"0 / 120 min"` on Exercise | IntelCard `value` | "0 of 120 target minutes this week" with an inline progress ring (Oura principle). |
| `"Keep logging your daily health data. As you do, the AI will surface patterns and predictions here."` | empty state | Keep tone but use `.empty-state` template + icon. |
| `"Doctor Mode / Visit prep + clinical PDF"` | Deeper Analysis | Add "Open" chevron affordance and make the description slightly longer: "Visit prep packet, clinical summary, and PDF export." |
| `"DAILY TARGET"` upper-case eyebrow | Nutrition card | Leave uppercase eyebrow (§1 Linear meta style) but soften the pill to plain text. |
| `"CONDITION REPORTS"` / `"DEEPER ANALYSIS"` section headers | section eyebrows | Keep uppercase eyebrow; add a subtitle below to anchor intent. |

## Fix plan

### Blockers (ship-stoppers)
- **B1. Em-dash in copy.** Rewrite the rendered Long Cycle message to drop the `--`. Strip/replace at the render boundary: replace occurrences of ` -- ` with `. ` or rebuild the sentence. Violates project rule and §15.
- **B2. INSUFFICIENT and RECUMBENT pills.** Replace with soft patient-friendly phrases ("Needs more data", "Gentle movement"). Violates §5, §6.
- **B3. Desktop flank waste.** Apply `.route-desktop-split` so intel cards live on the left and condition reports + deeper analysis live on the right at 1024+. §13.

### High
- **H1. Confidence pill decoupled from status color.** Render confidence as plain text ("Confidence: high") in the card meta row, not as a filled colored pill. Status color stays as card tint only.
- **H2. `.page-title` on h1** + `.route-hero` wrapper around header. Remove custom sparkle size inconsistency.
- **H3. Tabular nums** on every data value: cycle day, kcal, macros, bpm delta, min progress, test counts, ovulation date, period date.
- **H4. Long recommendation text splitting.** Break multi-clause recommendation sentences into two short sentences.
- **H5. Inline shadow formulas → tokens.** Replace `0 4px 12px rgba(107, 144, 128, 0.12)` with `var(--shadow-md)` in condition-report button hover. Move hover styles to a shared utility class pattern, remove JS onMouseEnter/onMouseLeave.
- **H6. `.press-feedback` on all tappable rows** (condition buttons, deeper-analysis links, any future card-as-link).
- **H7. Scarce accent.** Demote Doctor Mode's sage-filled pill to neutral with sage text only. Demote sparkle icon's fill or make the Intel header use `.route-hero__title`. One sage-primary per viewport.
- **H8. Exercise progress ring.** Small sage ring showing `currentUsage / estimatedMinutes` - Oura principle of "don't shame low scores, just show progress."
- **H9. Empty state template** for the whole-dashboard empty and the Vitals "needs more data" sub-state.

### Medium
- **M1. Raw hex in STATUS_COLORS.** Keep the `warn`/`critical` tints but reduce saturation and never use red-tinged `#FFEBEE` as card bg. Use cream/muted-blush for "pay attention" and a 2px left-border stripe rather than a pink card.
- **M2. Deeper Analysis destinations.** Add chevron + description per link. Each link feels like a destination, not an anchor.
- **M3. Download button states.** Add loading state (shimmer at top 1px while fetching) and "Ready to download" microcopy.
- **M4. Section headers.** Add a thin subtitle under "Condition Reports" and "Deeper Analysis" section eyebrows to anchor intent.

### Polish
- **P1. Card-level press-feedback** on the Intel cards (even though they're non-interactive, a subtle press affirms tactile behavior if they become tappable later - skip unless they become links).
- **P2. Slow-pulse skeleton** (1.5s 0.4↔0.7) instead of `animate-pulse` Tailwind default.
- **P3. Lucide icons** inline with each card title (18-20px, sage) to reinforce what each card is about.

## Deferred (outside my lane)
- API route `/api/intelligence/cycle` returns the `-- this cycle is longer...` string in `flag.message`. The fix at rendering time is safe; a deeper fix in the API is out of scope.
- Global CSS additions - not touched per contract.
- `BottomNav` and `AppShell` - not touched per contract.
