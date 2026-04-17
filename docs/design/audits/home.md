# /home (/) audit

**Purpose:** Give Lanae an at-a-glance snapshot of how today is going and the single next action she should take.
**Files:** `src/app/page.tsx`, `src/components/home/*`

## First impression (375 / 768 / 1440)

- **375:** Dense header with a shaming neutral emoji next to "Good evening". A red-tinged "SEVERE DAY" pill feels like a slap. Cycle/vitals row has ellipses ("..."), looking broken. The HRV card is clipped off the right edge, suggesting overflow. Three competing sage-filled buttons (big CTA, "Log Pain", "Log Period") fight for the eye.
- **768:** Same vertical stack, same violations, now in the center of a wide frame with tons of unused whitespace. Feels like a phone emulator in a browser window.
- **1440:** Worse: the mobile 640px column sits marooned in the middle of a 1440px desktop. No split, no reading experience. Violates §13 (Desktop layout rule) directly.

## Visual hierarchy

The Scarce Accent Rule is broken three ways:
1. Sage-gradient primary "Log your check-in" CTA
2. Sage-filled "Log Pain" pill
3. Sage-filled "Log Period" pill
All in the same viewport, so none feels primary.

The "SEVERE DAY" red-tinted pill is the loudest element on screen; it pulls attention away from the primary CTA and puts it on a symptom summary the user didn't ask for.

"12 active problems being tracked" is clinical and alarming; the sage left-border makes it feel like a sage-primary too.

## Clarity of purpose

Route exists to answer: "How is today going, and what should I do right now?" That question is obscured by the severity badge, the competing CTAs, and the ellipsis placeholders.

## Consistency violations (design-decisions.md)

Counted and categorized:

1. Neutral face emoji next to "Good evening" even when mood not logged — §5 (chronic-illness-aware), §11 (never celebrate low / never shame absent state).
2. "SEVERE DAY" shouty all-caps red pill — §5 explicitly renamed to "Rough day", §15 (prohibited patterns: shouty caps with red tints).
3. "12 active problems being tracked" — §5 rename rule: "Things we're watching".
4. Two additional sage-filled buttons (`Log Pain`, `Log Period`) — §3 Scarce Accent Rule.
5. SLEEP `...` and HRV `...` in the vitals strip — §4 & §11 forbid ellipses; use shimmer + "Syncing".
6. "Today's Data" label — §5 calls for warmer "How today looks so far".
7. "No cycle data" empty state — §4 template: "Cycle unknown. Add a period start in /log to begin tracking."
8. Numerics lacking `.tabular` class: CD value, streak number, PAIN/ENERGY/SLEEP/HRV values, DataCompleteness ring counter, calendar day numbers, detail panel sleep/hrv/resting values — §9.
9. Inline shadow formulas (NOT using shadow tokens):
   - `page.tsx` big CTA (line 427) — custom three-layer shadow
   - `page.tsx` cycle indicator card (line 527) — custom shadow
   - `QuickActions.tsx` primary gradient + shadow (lines 108-120)
   - `QuickStatusStrip.tsx` card shadow (line 132)
   All must be replaced with `var(--shadow-sm|md|lg)`.
10. Desktop ≥1024px layout is the mobile 640px column centered — §13 violation.
11. Interactive elements missing press-feedback: main CTA anchor, QuickActions pills, QuickStatusStrip cards, SmartCard body, DataCompleteness body, calendar day buttons, symptom severity banner — §10.
12. `AppointmentBanner.tsx` line 56 uses an em dash — " — " — §15 explicit ban.
13. `SmartCards.tsx` line 112 uses " | " separator piped with spaces that visually looks like a divider — minor, but the associated `rgba(...)` border color on line 226 is inline. Also shadow `var(--shadow-sm)` is correctly used, so this file is mostly OK. HRV below baseline and "Poor sleep detected" messages bypass §5's soft voice rewrites.
14. Microcopy: "Poor sleep detected" → should be "Rough sleep last night" (§5). "HRV below baseline" → "HRV softer than usual" (§5). "Great sleep last night!" has forbidden `!` (§5 exclamation rule — only for milestones).
15. Severity pill text lowercased shows "severe day" or "moderate day" in §5-conformant casing but is currently `textTransform: uppercase` plus fontWeight 700 — shouty.
16. CalendarHeatmap has inline rgba pain colors (red-tinged `rgba(220, 38, 38, 0.35)`) but those are used for a pain heatmap cell not a page background, so it's inside the allowed "pain palette inside a pain chart container" scope (§7). Leave alone.
17. CalendarHeatmap "No data" label — §4 forbids raw "No data" even in a tooltip. Rewrite.
18. `fetch()` weather call uses inline `catch(() => {})` — fine but unrelated.

## Delight factor: 3/10 — Rationale

Lanae opens her tracker first thing in the morning or right after a bad flare. Greeting her with a neutral face, a "SEVERE DAY" pill, and "12 active problems" tells her she is broken before she has read a single actual data point. The visual loudness is also scrambled: three primary-looking buttons, an overflowing vitals strip with ellipses in two of four positions, and a completely un-responsive desktop layout. A delightful home would start quiet, show one number, and invite a log. Today it accuses.

## Interactive states inventory

| Element | Rest | Hover | Active | Focus | Loading | Disabled |
| --- | --- | --- | --- | --- | --- | --- |
| Main CTA `/log` | Y | partial (transition defined but no transform) | N | global only | N | N |
| Symptom banner link | Y | N | N | global | N | N |
| Cycle mini card | Y (static div) | N | N | N | N | N |
| QuickStatusStrip Link cards | Y | transition only | N | global | N | N |
| QuickActions primary pills | Y | transition | N | global | N | N |
| QuickActions secondary pills | Y | transition | N | global | N | N |
| SmartCard View link | Y | N | N | global | N | N |
| DataCompleteness container | Y (not interactive) | - | - | - | - | - |
| CalendarHeatmap day buttons | Y | N | N | global | N | Y (disabled prop wired) |
| Prev/Next month buttons | Y | N | N | global | N | Y |
| AppointmentBanner link | Y | N | N | global | N | N |

Missing states: press feedback everywhere, explicit hover lift, explicit loading skeletons on data that might be pending.

## Empty states inventory

| Context | Current | Needs |
| --- | --- | --- |
| Cycle card with no data | "No cycle data" | §4 template rewrite |
| Vitals strip loading | `...` | shimmer + "Syncing" |
| No mood logged | neutral face emoji | no emoji, just greeting |
| No symptoms | banner just hidden | OK |
| Calendar detail, no Oura | "No Oura data for this day" | Keep, but check tone |
| Calendar cell, no pain | `getPainLabel` returns "No data" | Rewrite to "Not logged" |

## Microcopy audit

| Where | ❌ Old | ✅ New |
| --- | --- | --- |
| Greeting emoji when mood is absent | `Good evening 😐` | `Good evening` (no emoji) |
| Severity pill | `SEVERE DAY` (ALL CAPS red pill) | `Rough day` (sentence case, cream bg + soft blush border) |
| Severity description | `severe`/`moderate`/`mild` day | `Noticing severe symptoms today.` etc |
| Active problems card | `12 active problems being tracked` | `12 things we're watching` |
| Vitals placeholders | `...` | `Syncing` (shimmer bar on top of card) |
| Data completeness label | `Today's Data` | `How today looks so far` |
| Cycle empty | `No cycle data` | `Cycle unknown. Add a period start in /log.` |
| SmartCard warning | `HRV below baseline` | `HRV softer than usual` |
| SmartCard warning | `Poor sleep detected` | `Rough sleep last night` |
| SmartCard good | `Great sleep last night!` | `Good sleep last night` |
| AppointmentBanner | ` — ${doctor}` (em dash) | `, ${doctor}` |
| Calendar empty cell label | `No data` | `Not logged` |

## Fix plan

### Blockers
- Remove mood emoji fallback when mood is absent (page.tsx:366).
- Rewrite "SEVERE DAY" pill to "Rough day" (page.tsx:500-509).
- Rename "active problems being tracked" → "things we're watching" (SmartCards.tsx:145).
- Demote Log Pain & Log Period pills to neutral (QuickActions.tsx — Scarce Accent Rule).
- Replace `...` in SLEEP/HRV placeholders with shimmer + "Syncing" (QuickStatusStrip.tsx).
- Remove em dash in AppointmentBanner (AppointmentBanner.tsx:56).

### High
- Replace all inline shadow formulas with `var(--shadow-*)` (page.tsx, QuickActions.tsx, QuickStatusStrip.tsx).
- Add `.tabular` class to every numeric value.
- Desktop ≥1024px split layout using `.route-desktop-split`.
- Rename "Today's Data" → "How today looks so far" (DataCompleteness.tsx:68).
- Rewrite "No cycle data" empty state (page.tsx:546).
- Add `.press-feedback` to all interactive elements.

### Medium
- Softer SmartCards microcopy (Poor sleep detected → Rough sleep last night, HRV below baseline → HRV softer than usual, remove `!` in good-sleep message).
- Calendar `getPainLabel` "No data" → "Not logged".
- Hover lift states for CTA and cards.

### Polish
- Tighten AppointmentBanner to match card idiom (less intense sage border).
- Lanae's greeting: expose time-based tone on copy without emoji crutches.
