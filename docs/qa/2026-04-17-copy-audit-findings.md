# Non-shaming Voice Copy Audit Findings

**Date:** 2026-04-17
**Auditor:** Copy audit subagent (post Wave 1+2)
**Scope:** src/app, src/components, src/lib (user-facing strings)
**Rule:** docs/plans/2026-04-16-non-shaming-voice-rule.md

---

## Summary

- **VIOLATIONS (rewritten):** 11 user-facing sites across 7 files
- **ALLOWED-CLINICAL:** 4 sites (PDF reports, doctor page, PHQ-9 clinical scale)
- **ALLOWED-INTERNAL:** 18 sites (internal variable names, console errors, API errors, comments)
- **ALLOWED-TEST:** 10 sites (test fixtures that explicitly assert against banned words)
- **ALLOWED-MEDICAL:** 3 sites (medical symptom labels: "Incomplete evacuation", "Incomplete emptying", "Missed meal" factor label)
- **FALSE-POSITIVES:** 2 sites (context requires thought below)

---

## Classification by file

### VIOLATIONS (user-facing)

| File | Line(s) | Pattern | Context |
|---|---|---|---|
| `src/components/home/StreakBadge.tsx` | whole file | "streak" | Orphan component. No imports. Delete (unmounted already). |
| `src/components/log/DailyLogClient.tsx` | 43, 59, 296-303 | "streak", "Start your streak!" | Orphan component. No imports (only DailyStoryClient used). Delete. |
| `src/components/log/DailyStoryClient.tsx` | 45, 115-127 | "X day logging streak" badge in off-hours empty state | User-facing. Rewrite to neutral presence count. |
| `src/components/log/LogCarousel.tsx` | 61, 109, 647-655 | "X day streak", "Start your streak!" | Main log carousel header. Rewrite. |
| `src/app/log/page.tsx` | 27-41, 210-212, 283 | computeStreak function + prop pass | Internal variable name for server compute. Keep internal but rename display consumer. |
| `src/app/page.tsx` | 46, 134-140, 215-223, 400-425 | "streak" in home header | User-facing "Xd streak" chip. Rewrite. |
| `src/components/patterns/AdherenceDisplay.tsx` | whole file | "Adherence", "PDC", "Below 80%" | Patient-facing on Patterns page. Per rule, adherence framing is BANNED on patterns page. Reframe to neutral "Medication presence" factual view OR move to /doctor. Decision: reframe to neutral since patterns already shows mixed signals. |
| `src/components/patterns/SleepDebtDisplay.tsx` | 8, 106-110 | "Consistency score %" shown as metric | Rewrite label to non-score framing. |
| `src/components/log/NutritionCoachChat.tsx` | 236 | "No pressure, no streaks." | Referencing the banned word in an intro blurb. Rewrite. |

### ALLOWED-CLINICAL (exempt, pragma or clinical context)

| File | Line(s) | Why |
|---|---|---|
| `src/lib/reports/clinical-report.ts` | (whole file) | Clinician PDF. Per Clinical Nuance exception. Protected by `/* voice-rule-exempt: clinical-report */` pragma. |
| `src/lib/reports/advocacy-report.ts` | 38 "days logged" | Clinician PDF. Exempt. |
| `src/lib/api/medication-adherence.ts` | whole module | Internal clinician-facing helper (/doctor + PDF). Exempt. |
| `src/lib/clinical-scales.ts` | 59 "failure" | Standard PHQ-9 clinically validated instrument. Changing wording would invalidate the scale. Exempt. |

### ALLOWED-INTERNAL (not shown to user)

| File | Pattern |
|---|---|
| `src/lib/types.ts` | `RunStatus = 'failed'` enum value |
| `src/lib/api/**` | `Failed to fetch X` error thrown internally; caught by UI which shows its own copy |
| `src/lib/context/**` | `console.error('... failed')` |
| `src/lib/integrations/connectors/**` | OAuth token-refresh error strings |
| `src/lib/log/offline-drain.ts` | `failed` counter variable |
| `src/lib/medical-apis/**` | `console.warn('lookup failed')` |
| `src/lib/context/vector-store.ts` | `console.error('Embedding generation failed')` |
| `src/lib/migrations/**` | SQL comment prose |
| `src/lib/api/prn-doses.ts` | Comment: "we do NOT compute adherence, streaks..." (negative spec prose) |
| `src/lib/api/micro-care.ts` | Comment: "No streaks, no goal met" (negative spec prose) |
| `src/lib/ai/prompts.ts:18` | Claude prompt prose "MISSED or DISMISSED by clinicians" (internal instruction, not Lanae-facing) |
| `src/lib/ai/correlation-engine.ts:484` | Code comment "NEVER count as missed data" |
| `src/lib/intelligence/types.ts` | "Ebbinghaus forgetting curve" scientific term |
| `src/lib/intelligence/auto-trigger.ts` | "fire-and-forget" idiomatic async pattern |
| `src/lib/log/narrative-refresh.ts` | "Fire-and-forget" async idiom |
| `src/app/page.tsx:267` | "Fire-and-forget" async idiom |
| `src/lib/intelligence/insight-narrator.ts:382` | Comment: "if the model slipped one in" (about em dashes) |
| `src/lib/intelligence/personas/challenger.ts:28` | Challenger prompt prose "what the other personas missed" (internal) |
| `src/components/log/LiteLogCard.tsx:16` | Comment: "44px touch target compliance" (accessibility term) |

### ALLOWED-TEST (test fixtures asserting against banned words)

- `src/lib/personas/__tests__/nutrition-coach.test.ts`
- `src/lib/__tests__/micro-care-actions.test.ts`
- `src/lib/__tests__/intelligence/energy-inference.test.ts`
- `src/lib/__tests__/phase-insights.test.ts`
- `src/lib/intelligence/__tests__/nutrition-coach-context.test.ts`
- `src/lib/intelligence/__tests__/best-worst-aggregator.test.ts`
- `src/lib/__tests__/cycle-engine/cover-line.test.ts` (BBT "streak" = scientific biphasic-temperature term, unavoidable)

### ALLOWED-MEDICAL (clinical symptom vocabulary)

- `src/components/log/EndoMode.tsx:33,40` - "Incomplete evacuation", "Incomplete emptying" = standard medical terms for bowel/bladder dysfunction. Not shaming, they describe a symptom.
- `src/lib/lite-log/activities.ts:285-290` - "Missed meal" label on a symptom-factor chip. User TAPS this when it happened; it's self-report of a factual event, not the app accusing them. But "Missed" could sound shamey in the factor list; rewriting to "Skipped meal" (already the internal name) improves voice. Flagged as VIOLATION and rewritten.
- `src/lib/doctor/outstanding-tests.ts:99` - "incomplete emptying" - clinician-facing /doctor page. Exempt.

Revised: the `Missed meal` factor label WILL be rewritten. Moved from ALLOWED-MEDICAL to VIOLATIONS (total becomes 12 sites).

### FALSE-POSITIVES

- `src/lib/intelligence/cycle-engine/cover-line.ts:149` - comment about "biphasic streak" of BBT readings. Scientific/statistical term of art for consecutive elevated readings. Not a user-facing shame mechanic. Keep.
- `src/lib/ai/adaptive-calories.ts:226` - "On track. Current intake aligns with your goal." This uses "on track" which is close to the banned "back on track" phrase. Context is a nutrition coach tone reassuring about calories, but the rule bans "on track" framing. Flagged as VIOLATION - rewrite to "Current intake aligns with your X goal."

Revised: move adaptive-calories to VIOLATIONS (total becomes 13 sites, 8 files).

---

## Violations with proposed rewrites

### 1. `src/components/home/StreakBadge.tsx` (whole file)

**Decision:** Delete. Component is unmounted (no imports anywhere). Cleaner than rewriting since there is no surface to preserve.

### 2. `src/components/log/DailyLogClient.tsx`

**Decision:** Delete. Component is unmounted (log/page.tsx uses DailyStoryClient only). Orphan.

### 3. `src/components/log/DailyStoryClient.tsx` (lines 45, 115-127)

**Before:** Badge with "🔥 {N} day logging streak" in the off-hours fallback view.

**After:** Replace with a neutral presence chip: "Checked in {N} days this week" (cap at 7 so bad weeks show 0-2 without shame). If N === 0, hide the chip entirely.

- Remove `streak: number` prop. Add `checkInsThisWeek: number` instead.

### 4. `src/components/log/LogCarousel.tsx` (lines 61, 109, 647-655)

**Before:**
```tsx
{streak > 0 ? (<>🔥 {streak} day streak</>) : ('Start your streak!')}
```

**After:** Replace with: when `checkInsThisWeek > 0`, show "Checked in {N}x this week" in neutral sage. When 0, show nothing (per rule: "celebrate WHEN Lanae logs, stay silent when she doesn't").

### 5. `src/app/log/page.tsx` (lines 27-41, 210-212, 283)

**Before:** `computeStreak()` function, `streak` local, `streak={streak}` prop passing.

**After:** Rename to `computeCheckInsThisWeek()` returning a count of logged days in the last 7. Pass as `checkInsThisWeek={...}` to `DailyStoryClient`.

### 6. `src/app/page.tsx` (lines 46, 134-140, 215-223, 400-425)

**Before:** "🔥 Xd streak" chip in home header. Backed by `streakLogsResult` + `streak` compute.

**After:** Rewrite compute to `checkInsThisWeek` and render "Checked in {N}x this week" chip only when N > 0. Comments + variable names renamed.

### 7. `src/components/patterns/AdherenceDisplay.tsx`

**Before:** Shows "Adherent / Below 80%" PDC percentages on the Patterns page.

**Decision:** The Non-shaming Voice rule says adherence framing is exclusive to /doctor. This card is on Patterns (Lanae's UI). Options:

1. Delete the component + its mount in PatternsClient.
2. Rewrite to a neutral "Medication presence" view: factual counts only, no 80% thresholds, no "Adherent" labels.

Chose option 2 for the scheduled section (keep the dose-logged count factually) and option 1 for the "Below 80%" threshold logic. Rewritten to show: "X doses logged of Y days" without labeling. The PRN section is kept since it's purely descriptive usage counts (no adherence threshold).

Revised scheduled copy:
- Remove "PDC" label and "Adherent"/"Below 80%" pills.
- Heading: "Medication presence (30 days)"
- Per-med row: `{med.daysCovered} of {med.totalDays} days logged` (no percentage)
- Keep bar visualization but without color-coded threshold (use sage throughout).

PRN section mostly preserved (already neutral). The footer "Increasing PRN use may indicate worsening symptoms. Discuss with your doctor." is factual and survives.

### 8. `src/components/patterns/SleepDebtDisplay.tsx` (lines 8, 106-110)

**Before:** Label "Consistency (7d)" with "{score}%" displayed large.

**After:** Keep the underlying consistency metric (it's useful), but rename display label to "Sleep rhythm (7d)" and show the raw bed/wake variance instead of a percentage "score". Drop the % sigil; show instead "Bed ~11:45p, Wake ~8:10a" when available (already shown below). The rule specifically bans "consistency score" as a surfaced metric.

Also update comment block (line 4-11) to drop "Sleep Consistency score" language.

### 9. `src/components/log/NutritionCoachChat.tsx` (line 236)

**Before:** "No pressure, no streaks."
**After:** "No pressure, just facts when you want them."

### 10. `src/lib/lite-log/activities.ts` (lines 285-290)

**Before:** `label: 'Missed meal'`, `description: 'Missed or delayed a meal'`
**After:** `label: 'Skipped meal'`, `description: 'Skipped or delayed a meal'` (matches internal `name: 'Skipped meal'` already)

### 11. `src/lib/ai/adaptive-calories.ts` (line 226)

**Before:** "On track. Current intake aligns with your ${goal} goal."
**After:** "Current intake aligns with your ${goal} goal."

---

## Rewrites: summary

Files modified for user-facing rewrites:
1. `src/components/home/StreakBadge.tsx` - deleted
2. `src/components/log/DailyLogClient.tsx` - deleted (unmounted orphan; removing reduces maintenance surface)
3. `src/components/log/DailyStoryClient.tsx` - rewrote streak -> weekly check-in count
4. `src/components/log/LogCarousel.tsx` - rewrote streak -> weekly check-in count
5. `src/app/log/page.tsx` - renamed compute helper, updated prop
6. `src/app/page.tsx` - rewrote streak chip + compute
7. `src/components/patterns/AdherenceDisplay.tsx` - removed threshold/labels, neutralized
8. `src/components/patterns/SleepDebtDisplay.tsx` - relabel "Consistency score"
9. `src/components/log/NutritionCoachChat.tsx` - copy tweak
10. `src/lib/lite-log/activities.ts` - "Missed meal" -> "Skipped meal"
11. `src/lib/ai/adaptive-calories.ts` - drop "On track." lead

Plus enforcement:
- `scripts/check-voice.mjs` (new)
- `package.json` (script entry)
- `CLAUDE.md` (rule added)

---

## Running total

- Violations identified (including revised): **13 sites in 8 files**
- Files rewritten: **9 files** (2 deleted, 7 edited)
- Clinician/report copy left intact under Clinical Nuance exception: **4 files**
