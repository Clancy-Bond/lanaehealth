# Design Decisions (Subagent Contract)

**Status:** Locked 2026-04-16. All research and implementation subagents MUST read this file and follow it literally. Do not invent rules. Do not contradict this file.

This file is the consistency anchor for parallel work across 12 routes. The inspiration background is in [`2026-findings.md`](./2026-findings.md); this file is the prescriptive extract.

---

## 1. Motion tokens (MUST add to globals.css)

```css
:root {
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-decelerate: cubic-bezier(0, 0, 0.2, 1);
  --ease-accelerate: cubic-bezier(0.4, 0, 1, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-ios: cubic-bezier(0.32, 0.72, 0, 1);

  --duration-instant: 100ms;
  --duration-fast: 150ms;
  --duration-base: 200ms;
  --duration-slow: 300ms;
}
```

### Use
- State change (hover, color shift): `150ms var(--ease-standard)`
- Enter animation (modal, sheet): `200ms var(--ease-ios)`
- Exit: `160ms var(--ease-accelerate)`
- Press-down feedback: scale 0.97 for 80ms, ease-out
- Celebration pop (checkmark): `180ms var(--ease-spring)`

## 2. Spacing tokens (MUST add to globals.css, reuse Tailwind 4-pt grid)

```css
:root {
  --space-1: 4px;  --space-2: 8px;
  --space-3: 12px; --space-4: 16px;
  --space-6: 24px; --space-8: 32px;
  --space-12: 48px; --space-16: 64px;
}
```

### Use
- Tight internal card padding: `var(--space-3)` or `--space-4`
- Section gap: `--space-6`
- Route-level section separator: `--space-8`
- Between hero sections: `--space-12`

## 3. Scarce Accent Rule (CRITICAL)

**Only ONE sage-primary element per viewport at a time.**

- Sage (`#6B9080`) is for: the single primary call-to-action on the screen, active nav item, and single focus state.
- NOT sage: secondary buttons, metric dots that aren't highlighting a problem, cycle day label backgrounds, progress rings that aren't the "log now" CTA.
- If you see two sage filled buttons in the same viewport, demote one to neutral.
- Blush is for: cycle/period context, symptom alerts, pain severity chips (when within pain chart context only). NEVER for page background.

## 4. Empty-state voice (MUST follow template)

Template: `[Gentle state]. [Next action in imperative, optional.]`

| Context | ❌ Old | ✅ New |
| --- | --- | --- |
| No log today | "No data" | "Nothing logged yet today. Tap the green button when you're ready." |
| No labs | "No lab results found" | "No labs here yet. Import from myAH or upload a PDF." |
| Cycle unknown | "No cycle data" | "Cycle unknown. Add a period start in /log to begin tracking." |
| Pending Oura | "..." | "Syncing..." (with shimmer; never just dots) |
| No correlations | "No patterns found" | "Patterns appear here after 14 days of logging." |
| No active problems | "None" | "All clear. Active conditions will show up here." |
| Timeline empty | "No events" | "Your timeline is waiting for its first event." |

**Never use:** "No data", "Empty", "None", "Nothing", "No X found" on its own.

## 5. Microcopy rules

- `...` ellipses forbidden in UI strings. Use "Loading" or specific verb.
- Exclamation points forbidden except on milestones (7/30/100 day streak).
- Second-person warmth: "Your labs", "Your chart", "Your timeline" over "Labs", "Chart", "Timeline" when on detail views.
- "Saving" → "Saved" (not "Saving..." → "Saved!")
- Errors: `"Something broke on my end. Try again?"` not `"Error: Request failed"`
- Loading: `"One moment, pulling your data"` not `"Loading..."`
- "Active problems" → **"Things we're watching"** (app-wide rename of user-facing string only; DB field stays)
- "SEVERE DAY" badge → **"Rough day"** (never shouty caps with red-tinged pill)
- "Poor sleep detected" → **"Rough sleep last night"**
- "HRV below baseline" → **"HRV softer than usual"**

## 6. Chronic-illness-aware language

- Never "missed", "failed", "forgot", "streak broken", "worst".
- Replace with "not logged", "not yet", "paused", "a tough stretch".
- No celebration of low scores. No mocking of high pain.
- If showing a "low recovery" state, use cream/neutral background, never red. A subtle blush left-border at most.

## 7. Color discipline

Only these hues are allowed in any single viewport:
- Cream (bg): `#FAFAF7` / `#F5F5F0` / `#FFFFFF`
- Text: `#1A1A2E` primary, `#6B7280` secondary, `#8B8F96` muted
- Sage: `#6B9080` or its muted `rgba(107,144,128,0.12)`
- Blush: `#D4A0A0` or its muted `rgba(212,160,160,0.12)`
- Pain palette ONLY inside pain-chart containers
- Cycle phase ONLY inside cycle-specific contexts

Red `#EF4444` for pain-extreme is forbidden as page/card background. It may appear as a 1px or 2px accent stripe only.

## 8. Shadow rule (two resting, one elevated)

Use only:
- `var(--shadow-sm)` — resting cards
- `var(--shadow-md)` — hover/pressed cards
- `var(--shadow-lg)` — modals/overlays

Inline shadow formulas in component code must be REPLACED with variables. If a custom shadow feels necessary, add it as a new token in globals.css first. Do not bury one in a component.

## 9. Tabular numerics globally

Add to `globals.css`:
```css
.tabular,
[data-numeric],
.stat {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}
```

And apply `className="tabular"` or `data-numeric` to every rendered data value (labs, counts, timestamps, cycle day, scores).

## 10. Interactive states (ALL 6 REQUIRED per element)

Every interactive element (button, link, tappable card) must have:
1. **Resting** — default visual
2. **Hover** — `translateY(-1px)` + `var(--shadow-md)` OR background tint shift (pick one per element type and stay consistent)
3. **Active/pressed** — `scale(0.97)` for 80ms
4. **Focus** — existing global `focus-visible` (already in globals.css) suffices if element doesn't have custom focus; custom focus must use sage 2px outline at 2px offset
5. **Loading** — if element triggers an async action, show inline progress (button fills left-to-right 300ms with progress-fill keyframe OR spinner-less shimmer top edge)
6. **Disabled** — `opacity: 0.5; cursor: not-allowed; pointer-events: none`

## 11. Loading language (no spinners)

- **Block content**: skeleton rows at 1.5s pulse cycle, opacity 0.4 ↔ 0.7
- **Inline fetch**: 1px top-of-container shimmer gradient, 1.5s left-to-right loop
- **Form submit**: fill-on-save button (accent fills left-to-right 300ms, checkmark appears inside at completion)
- No `<Spinner />` or `⟳` or `Loading...` text allowed

## 12. Page shell contract

Every route page must:
- Render a single `h1.page-title` (already in globals.css) at its top
- Have a single **hero block** that answers the one question the route exists for
- Respect `max-width: 640px` centered on mobile/tablet; at `>=1024px` use a grid or split-pane layout (not just centered)
- Use `padding-top: var(--space-3)` and `padding-bottom: var(--space-6)` at minimum

## 13. Desktop layout rule

For viewports `>=1024px`:
- If a route has a single column on mobile, it must either:
  - (a) Widen to 720-860px and feel deliberately narrow (reading experience), OR
  - (b) Split into a 2-column layout where the left is primary content and right is summary/meta
- NEVER leave a mobile 640px layout centered in a 1440px viewport with empty flanks — this is the current pattern on most routes and is forbidden after this pass.

## 14. Icon and asset rule

- Lucide icons at 18-24px, strokeWidth 2 (active: 2.5)
- Favor Lucide over custom SVG
- Illustrations (empty states) use Lucide icons at 48-64px, 30% opacity, sage-tinted

## 15. Prohibited patterns

- Em dashes in copy (`—`) — project-wide rule. Use semicolon, colon, comma, or two sentences.
- Red `#EF4444` as page background or primary action color
- Spinners (`⟳`, `<Spinner />`, rotate animations on circular icons) for loading
- "..." trailing ellipses in UI strings
- Shouty ALL-CAPS pills with red tints on a user's dashboard
- More than one sage-filled button per viewport
- Inline shadow formulas — must use tokens

## 16. Commit message convention

Each route's implementation subagent commits with:
```
design: refresh /<route> — <1-line summary>

Applies design-decisions.md vocabulary:
- <bullet 1>
- <bullet 2>
```

## 17. What subagents MUST NOT do

- Edit `globals.css` (main session handles foundational tokens)
- Edit BottomNav.tsx or AppShell.tsx (main session handles global chrome)
- Introduce new dependencies
- Modify Supabase schema or any data
- Add new files outside `src/components/<route>/` or `src/app/<route>/`
- Amend other routes' files (stay in your lane)
- Run migrations
- Push to remote

## 18. What subagents MUST do

- Read `docs/design/design-decisions.md` (this file)
- Read their route's existing files
- Read their route's `audit-results.md` entry (if it exists)
- Implement fixes in priority order: blocker → high → medium → polish
- Every interactive element gets all 6 states
- Every empty state gets the warm template
- Every piece of microcopy gets rewritten per section 5
- Commit locally with the convention in section 16
- Report a structured summary when done (see template in research brief)

## 19. Verification checklist (every subagent runs before signaling done)

- [ ] No em dashes in any changed string
- [ ] No inline shadow formulas; all use `var(--shadow-*)`
- [ ] No Spinners or `...` strings
- [ ] Every new microcopy matches sections 4, 5, 6
- [ ] At most one sage-filled primary button per viewport
- [ ] All interactive elements have all 6 states
- [ ] All numerics in data views have `className="tabular"` or `data-numeric`
- [ ] `npx tsc --noEmit` passes (from project root)
- [ ] Desktop (>=1024px) layout is NOT just a centered mobile column
