You are owning the **Calorie / Food section** of LanaeHealth's v2 mobile UI for this session.

**Blocked on:** `prompts/00-viewport-fix.md` must land first. Do not begin until the foundation viewport PR is merged to `main`. Confirm with `git log --oneline | grep -i "foundation: fix horizontal overflow"` before starting.

## Read first, in this order

1. `CLAUDE.md`.
2. `docs/current-state/INDEX.md`.
3. `docs/current-state/sessions/calorie.md` (note: brief is intentionally thin because the recording does not exercise the food flows).
4. `docs/current-state/known-issues.md` (especially #4: this surface is shallow in the recording; you may need to capture a follow-up).
5. `docs/sessions/README.md` (locked-files rule).
6. `docs/reference/mynetdiary/` (north-star UX) and `docs/reference/oura/` (chrome).
7. Frames: `docs/current-state/frames/2026-04-29-app-tour/frame_0020.png` through `frame_0029.png`.
8. Recent commits that touched food: `git log --oneline -- src/app/v2/calories | head -30`.

## Your scope

Only `src/app/v2/calories/**`. Anything else is locked.

## What I want from this session

1. **Capture a focused recording.** The 6m24s tour caught Find a food mid-skeleton with no populated state. Spin up `lanaehealth-dev` on port 3005, drive a real food search and add through the simulator (or your phone), and screen-record. Save to `docs/current-state/recordings/<YYYY-MM-DD>-food-flow.mp4`, then run `scripts/extract-reference-frames.sh docs/current-state/recordings/<YYYY-MM-DD>-food-flow.mp4 0.30`. Update `docs/current-state/sessions/calorie.md` with the new frame ranges.
2. **Interactivity audit.** Same as the other sessions: enumerate every interactive element in `src/app/v2/calories/**`, file `docs/current-state/audits/calorie.md` with element / location / exercised? columns. The autocomplete from `d7bb5e7 feat(food/search): live autocomplete (debounced URL push)` and the unit picker from `fe004a9 feat(food/units)` are obvious starting points.
3. **Viewport bug check.** Per `known-issues.md` #1 and #2. Food likely has tabular nutrition data (calories, macros, micros) that often triggers horizontal overflow on mobile. Verify and diagnose. Fix if it lives in your locked files; FOUNDATION-REQUEST if it lives in shared markdown or table primitives.
4. **MFN-aligned visual pass.** Hold each food surface against `docs/reference/mynetdiary/`. The reference is the spec. Note concrete deltas, implement the ones in scope, foundation-request the rest.
5. **E2E.** At least one happy-path test for the food add flow at `tests/e2e/`. Existing baseline coverage is at `tests/e2e/calories*` (per CLAUDE.md). Run `npm run test:e2e` before claiming done.

## Constraints

- Real patient data. Food entries write to the `food_entries` table. Zero data loss; never delete or truncate without explicit user confirmation.
- No em-dashes.
- Static/dynamic boundary applies if you touch any Claude API call (food clarification, nutrition lookup): stable instructions FIRST, dynamic state LAST.
- Memory is HINTS - verify against the database.

## Deliverable

Feature branch (or one PR) with: the new focused recording (gitignored binary, but you commit the brief update), the audit, the viewport diagnosis, the visual pass, and at least one passing E2E test. End with a summary paragraph in `docs/current-state/audits/calorie.md`.
