# Priority 0: Fix the app-wide horizontal-overflow bug

You are owning the **app-wide viewport / sizing fix** for LanaeHealth's v2 mobile UI. This runs **before** the six section prompts fan out. No section work begins until this lands.

## Why this is priority zero

In the 2026-04-29 app tour (`docs/current-state/recordings/2026-04-29-app-tour.mp4`), most screens scroll horizontally. Content is wider than the viewport on a real iPhone, so lines clip on the left and right edges. Examples (frame -> what shows -> what should show):

- 0001 -> "ow are you feeling?" -> "How are you feeling?"
- 0060 -> "TS / Autonomic Dysfunction" -> "POTS / Autonomic Dysfunction"
- 0060 -> "ling pulse 106 bpm vs. resting 70 bpm" -> "Standing pulse 106 bpm vs. resting 70 bpm"
- 0095 -> "ot me saying you have IBD." -> "Not me saying you have IBD."
- 0105 -> "ck today. The three highest priority" -> "Back today. The three highest priority"

The user's words: "the app was visually disappointing especially the size it was going from side to side mobile apps shuld not do that." This is the single most user-impactful issue in the app right now.

## Read first, in this order

1. `CLAUDE.md` (especially "v2 mobile UI" - the foundation rules apply directly to this work).
2. `docs/current-state/known-issues.md` sections #1 and #2.
3. `docs/current-state/INDEX.md` (every section in the recording is potentially affected).
4. `docs/sessions/README.md` (so you understand what locked files mean for section sessions; you have permission to edit those, they do not).
5. `docs/v2-design-system.md` if present.
6. The frames themselves: at minimum 0001, 0057, 0060, 0070, 0080, 0095, 0100, 0105, 0113.

## Your scope

You have foundation-level edit rights. You may edit:

- `src/v2/theme/tokens.css`
- `src/v2/components/primitives/**`
- `src/v2/components/shell/**`
- `src/app/v2/layout.tsx`
- Markdown / table / code-block renderers wherever they live (likely under primitives or doctors)
- Global CSS (`src/app/globals.css`) only if it is the right home for the fix

You may **read** every section's source to confirm the diagnosis. You should not write fixes inside a section's `/v2/<section>/**` files; that is what makes this a foundation pass instead of a section pass. If a fix truly belongs in section code, document it in your handoff and let that section session do it.

## Diagnostic protocol (do not skip)

The temptation will be to slap `overflow-x: hidden` on the body and call it a day. Do not. That hides symptoms and breaks scroll-anchored UI in subtle ways. Diagnose first.

1. **Reproduce on a real mobile viewport.** Start `lanaehealth-dev` on port 3005. Use the Chrome DevTools mobile emulator at iPhone 13 Pro size (390x844) or smaller, plus the Safari Web Inspector against the actual Capacitor iOS shell if available. Visit each frame's surface in order: chat sheet, home, cycle, cycle insights, food, settings, login, doctor analysis.
2. **For each surface that overflows, find the exact culprit.** In DevTools: select `<html>`, read `scrollWidth` vs `clientWidth`. If `scrollWidth > clientWidth`, walk the DOM with `Array.from(document.querySelectorAll('*')).filter(el => el.scrollWidth > el.clientWidth)`. The shortest descendant in that list is the offender.
3. **Categorize the cause.** Likely categories, in roughly decreasing probability:
   - Markdown rendering of long unbroken tokens (`100/100`, `3.2 mg/L`, pipe-separated tables) without `overflow-wrap: anywhere` or `word-break: break-word` on the prose container.
   - Tables inside markdown that exceed viewport width without horizontal scroll containment on the table wrapper.
   - Code or pre blocks inheriting `white-space: pre` and not constrained.
   - A flex row with `flex-wrap: nowrap` and content that exceeds the viewport (cycle phase recommendations, hypothesis cards).
   - A primitive with hardcoded pixel widths from a desktop draft.
   - The Capacitor `WebView` reporting a viewport wider than the device. Check `<meta name="viewport">` in the served HTML; `width=device-width, initial-scale=1, viewport-fit=cover` is the canonical correct value.
4. **Confirm root cause is single or few.** If five surfaces all overflow because of the same markdown component, that is one fix. If they overflow for different reasons, list each.

## Success criteria

When you claim this fix is done, the following must all be true:

1. **No surface scrolls horizontally on a 390px-wide viewport.** Define a Playwright assertion you can run on every `/v2/*` route:
   ```ts
   await expect.poll(async () => await page.evaluate(
     () => document.documentElement.scrollWidth <= window.innerWidth + 1
   )).toBe(true);
   ```
   Add this assertion to a new file `tests/e2e/viewport.spec.ts` that iterates through every v2 route the suite knows about (or hardcodes the list of routes covered by the recording).
2. **Existing E2E suite passes.** `npm run test:e2e` must be green on both the WebKit (iPhone 13 Pro) and mobile Chromium (Pixel 7) projects from `playwright.config.ts`.
3. **No surface has clipped text.** Manually re-walk the surfaces from the recording (chat composer, home, cycle, cycle insights, settings, doctor mode top-to-bottom) and confirm by eye.
4. **No `overflow-x: hidden` band-aids on body, html, or any shell wrapper.** Audit your own diff. The fix should be local to whatever component caused the overflow, not a global suppression.

## Output expectations

1. **A FOUNDATION PR** (or feature branch ready to merge) titled `foundation: fix horizontal overflow across v2`.
2. **A short diagnosis writeup** at `docs/current-state/audits/00-viewport-fix.md`. Three sections: (a) root causes found, with file paths and a one-line cause for each; (b) the fix per cause; (c) screens you walked and their before/after status.
3. **The new viewport E2E spec** at `tests/e2e/viewport.spec.ts`.
4. **An updated `docs/current-state/known-issues.md`** marking issues #1 and #2 as resolved with a pointer to the PR.

## Constraints

- Real patient data. Zero data loss.
- No em-dashes anywhere (code, copy, commit messages, PR titles, your responses).
- The Warm Modern palette is for explanatory surfaces only. Do not migrate dark chrome to cream while you are here.
- Memory is HINTS, not GROUND TRUTH. If the codebase pattern you remember conflicts with what is on disk, the disk wins.
- This is a foundation pass. Resist scope creep into design or copy quality changes; those belong to the section sessions that follow.
- iOS shell: the app is wrapped in Capacitor (commit `54f52ef`). Confirm fixes hold inside the WebView, not just in mobile Chrome.

## Deliverable timing

This blocks all six section prompts (`cycle`, `calorie`, `chat`, `login`, `doctors`, `data`). Land this PR, then re-broadcast the merged main commit hash to those sessions. They start from your fix.
