You are owning the **Cycle section** of LanaeHealth's v2 mobile UI for this session.

**Blocked on:** `prompts/00-viewport-fix.md` must land first. Do not begin until the foundation viewport PR is merged to `main`. Confirm with `git log --oneline | grep -i "foundation: fix horizontal overflow"` before starting.

## Read first, in this order

1. `CLAUDE.md` (whole project guardrails).
2. `docs/current-state/INDEX.md` (where the recording lives, what it covers).
3. `docs/current-state/sessions/cycle.md` (what your surface looks like today).
4. `docs/current-state/known-issues.md` (app-wide bugs you must verify on Cycle).
5. `docs/sessions/README.md` (locked-files rule + FOUNDATION-REQUEST process).
6. `docs/reference/natural-cycles/` (north-star UX) and `docs/reference/oura/` (north-star chrome).
7. The frames themselves: `docs/current-state/frames/2026-04-29-app-tour/frame_0011.png` through `frame_0019.png`, plus `frame_0045.png` and `frame_0046.png`.

## Your scope

You may edit only `src/app/v2/cycle/**` and files clearly internal to those routes. Anything in `src/v2/components/primitives/**`, `src/v2/components/shell/**`, `src/lib/**`, `src/app/api/**`, or any other section's `/v2/<section>/**` is locked. Cross-cutting fixes go through FOUNDATION-REQUEST, not direct edits.

## What I want from this session

1. **Interactivity audit.** The screen recording shows state changes but not taps. Read your section's source, enumerate every interactive element (button, Link, onClick, onPress, gesture handler), and produce a short markdown list at `docs/current-state/audits/cycle.md` with three columns: element, location (file:line), exercised in recording? (yes/no/unclear). Flag any "looks tappable but is not" or "is tappable but has no handler" as a follow-up.
2. **Viewport bug check on Cycle.** Per `known-issues.md` #1 and #2, verify whether Cycle suffers the horizontal-overflow problem. The Cycle landing in frame 0012 looks correctly sized, but the Cycle insights page (frame 0018, "Temperature pattern") and any deep card may not. Open the dev server (`lanaehealth-dev` on port 3005), navigate `/v2/cycle` and `/v2/cycle/insights` (and any sibling routes), and look for content wider than the viewport. If you find any, diagnose it - do **not** patch with `overflow-x: hidden`; identify the root cause.
3. **Visual quality pass.** The user said the app is "visually disappointing." For Cycle specifically, hold each frame against `docs/reference/natural-cycles/` and the Warm Modern + Oura-derived palette tokens at `src/v2/theme/tokens.css`. List concrete deltas (spacing, type scale, color, density, copy voice) you would address. Implement the ones inside your locked files. File FOUNDATION-REQUESTs (one PR each, small) for cross-cutting needs.
4. **E2E.** Per CLAUDE.md, every user-facing change adds at least one E2E test. The cycle suite lives in `tests/e2e/`. Run `npm run test:e2e` before claiming completion.

## Constraints

- Real patient data. Zero data loss.
- No em-dashes anywhere (code, copy, commit messages, PR titles, your responses).
- The Warm Modern cream/blush/sage palette is reserved for explanatory surfaces (`.v2-surface-explanatory`). Cycle landing uses the dark Oura-derived chrome.
- Memory is HINTS, not GROUND TRUTH - verify recalled state against the live database before stating it.

## Deliverable

A small set of commits on a feature branch (or one PR) that includes: the interactivity audit, the viewport diagnosis with either a fix or a written FOUNDATION-REQUEST, the visual deltas implemented within scope, and at least one passing E2E test for whatever flow changed. End your session with a one-paragraph summary in `docs/current-state/audits/cycle.md`'s last section: what you fixed, what you punted to foundation, what you learned about the surface that the brief did not capture.
