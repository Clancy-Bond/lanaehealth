# LanaeHealth Design Audit Results

**Audit window:** 2026-04-16
**Breakpoints:** 375px (iPhone SE), 768px (iPad), 1440px (Desktop)
**Priority:** blocker → high → medium → polish
**Vocabulary reference:** [2026-findings.md](./2026-findings.md)
**Subagent contract:** [design-decisions.md](./design-decisions.md)
**Gallery:** [before-after/README.md](./before-after/README.md)

This file consolidates the per-route audits into a single report. Each route's detailed audit lives in [audits/<route>.md](./audits/).

---

## Route index

| Route | Status | Delight before → after | Audit | Screenshots |
| --- | --- | --- | --- | --- |
| `/` (home) | Complete | 6 → 9 | [home.md](./audits/home.md) | [home/](./before-after/home/) |
| `/log` | Complete | 6 → 8 | [log.md](./audits/log.md) | [log/](./before-after/log/) |
| `/chat` | Complete | 6 → 8 | [chat.md](./audits/chat.md) | [chat/](./before-after/chat/) |
| `/doctor` | Complete | 5 → 8 | [doctor.md](./audits/doctor.md) | [doctor/](./before-after/doctor/) |
| `/imaging` | Complete | 5 → 9 | [imaging.md](./audits/imaging.md) | [imaging/](./before-after/imaging/) |
| `/import`, `/import/myah` | Complete | 3 → 8 | [import.md](./audits/import.md) | [import/](./before-after/import/) |
| `/intelligence` | Complete | 5 → 8 | [intelligence.md](./audits/intelligence.md) | [intelligence/](./before-after/intelligence/) |
| `/onboarding` | Complete | 5 → 9 | [onboarding.md](./audits/onboarding.md) | [onboarding/](./before-after/onboarding/) |
| `/patterns` | Complete (crash fixed) | 0 → 7 | [patterns.md](./audits/patterns.md) | [patterns/](./before-after/patterns/) |
| `/profile` | Complete | 6 → 9 | [profile.md](./audits/profile.md) | [profile/](./before-after/profile/) |
| `/records` | Complete | 5 → 8 | [records.md](./audits/records.md) | [records/](./before-after/records/) |
| `/settings` | Complete | 4 → 8 | [settings.md](./audits/settings.md) | [settings/](./before-after/settings/) |
| `/timeline` | Complete | 5 → 7 | [timeline.md](./audits/timeline.md) | [timeline/](./before-after/timeline/) |

## Fix summary

### Blockers resolved
- `/patterns` React hooks crash (`Rendered fewer hooks than expected`) — route unusable before, returns 200 now
- `/import` 404 (Next.js default) — replaced with a clean landing page that routes to `/import/myah`
- PWA icon 404s (`/icon-192.png`, `/icon-512.png`) — manifest now points to a single `/icon.svg`
- Runtime "calculateCyclePhase is not defined" error on `/log` after batch 1 — resolved with a cache-busting touch on `prefill.ts` during verification

### High-priority patterns applied across 12 routes
- Em dashes removed from all UI copy (and `--` double-hyphens that render like em dashes)
- `...` ellipses removed from every button, loading state, and placeholder
- All Lucide spinners replaced with `.shimmer-bar` or `.skeleton`
- `var(--shadow-sm|md|lg)` replaces every inline shadow formula
- Tabular nums applied via `.tabular` on every rendered data value (scores, dates, counts, vitals)
- Scarce Accent Rule enforced: at most one sage-filled primary per viewport on every route
- Desktop ≥1024px layouts switched from centered mobile columns to `.route-desktop-wide` or `.route-desktop-split`
- Empty states rewritten using the warm template (`[Gentle state]. [Next action].`)
- Every interactive element has the required 6 states (resting, hover, active, focus, loading, disabled)
- Press-feedback class applied to every tappable surface

### Chronic-illness-aware microcopy updates
| ❌ Before | ✅ After |
| --- | --- |
| "SEVERE DAY" (shouty red pill) | "Rough day" (soft blush badge) |
| "12 active problems being tracked" | "12 things we're watching" |
| "HRV below baseline" | "HRV softer than usual" |
| "Poor sleep detected" | "Rough sleep last night" |
| "RECUMBENT" | "Gentle movement" |
| "INSUFFICIENT" | "Needs more data" |
| "Error: Request failed" | "Something broke on my end. Try again?" |
| "Loading..." / "Saving..." | "Loading" / "Saving" / "One moment, pulling your data" |
| "No data" / "None documented" | "No medications on file. Add one to share with your doctor." |
| "No cycle data" | "Cycle unknown. Log a period to begin tracking." |

### Foundation additions (globals.css)
- Motion tokens: `--ease-standard`, `--ease-decelerate`, `--ease-accelerate`, `--ease-spring`, `--ease-ios`; `--duration-instant|fast|base|slow`
- Spacing tokens: `--space-1` through `--space-16` on a 4pt grid
- Utility classes: `.tabular`, `.empty-state` (+ `__icon|__title|__hint`), `.shimmer-bar`, `.skeleton`, `.press-feedback`, `.route-hero` (+ `__eyebrow|__title|__subtitle`), `.route-desktop-wide`, `.route-desktop-split`

## Remaining deferred items (documented per-route)

- Command-K global search (cross-route feature, out of scope for this pass)
- `/patterns` progressive-disclosure hero card (medium priority next pass)
- `/doctor` print stylesheet for PDF export (medium priority next pass)
- `LoadingSpinner.tsx` global component still referenced by a few `loading.tsx` files (touches global chrome, deferred)
- AI-generated chat content contains em dashes; this is outside our lane per the contract

## TypeScript status

`npx tsc --noEmit` passes on every design-touched file. The four remaining TS errors are all in pre-existing test files under `src/app/api/.../__tests__/*` and `src/lib/__tests__/*`. None are in the design lane.

## Console status

All design-related routes load without errors introduced by this pass. One pre-existing warning about `404 /icon-192.png` was resolved by switching the manifest to `/icon.svg`.
