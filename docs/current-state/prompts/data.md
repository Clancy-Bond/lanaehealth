You are owning the **Data / Records / Labs / Imaging / Import** surfaces of LanaeHealth's v2 mobile UI for this session.

**Blocked on:** `prompts/00-viewport-fix.md` must land first. Do not begin until the foundation viewport PR is merged to `main`. Confirm with `git log --oneline | grep -i "foundation: fix horizontal overflow"` before starting.

## Read first, in this order

1. `CLAUDE.md` (especially "Critical Rules" - ZERO data loss rule applies most strongly here).
2. `docs/current-state/INDEX.md`.
3. `docs/current-state/sessions/data.md` - **note this brief is intentionally thin; the recording does not exercise these surfaces at all.** You are starting cold visually.
4. `docs/current-state/known-issues.md` - especially #5 (no frames for these routes).
5. `docs/sessions/README.md` (these surfaces share a "Doctor & Records" session in the existing v2 plan; coordinate with the doctors session if both are live).
6. The doctor frames `docs/current-state/frames/2026-04-29-app-tour/frame_0057.png` through `frame_0113.png` are still relevant as **content** because lab values and imaging studies appear inside the diagnostic analysis there.

## Your scope

Bundled per `docs/sessions/README.md`:

- `src/app/v2/records/**`
- `src/app/v2/labs/**`
- `src/app/v2/imaging/**`
- `src/app/v2/import/**`

Database tables you read but do not migrate:

- Existing (DO NOT MODIFY structure): `lab_results`, `documents`, `nc_imported`
- New: `imaging_studies`, `medical_timeline`, `health_embeddings`

## What I want from this session

1. **Capture a focused recording.** Step one. Spin up `lanaehealth-dev` on port 3005, walk through `/v2/records`, `/v2/labs`, `/v2/imaging`, `/v2/import/*`, screen-record (~3-5 min). Save as `docs/current-state/recordings/<YYYY-MM-DD>-data-tour.mp4` and run `scripts/extract-reference-frames.sh docs/current-state/recordings/<YYYY-MM-DD>-data-tour.mp4 0.30`. Update `docs/current-state/sessions/data.md` with frame ranges per route.
2. **Interactivity audit.** Enumerate every interactive element across the four route groups. File `docs/current-state/audits/data.md`. Flag any record that "looks readable but is not openable" or any document that has no preview or download path.
3. **Viewport bug check.** Per `known-issues.md` #1 and #2. Lab tables are the canonical place this bug shows up on mobile (long lab names, value+unit columns, reference ranges). Reproduce, diagnose, file a FOUNDATION-REQUEST if the fix lives in shared table/markdown primitives (likely it does, and likely the doctors session is already filing one - coordinate).
4. **ZERO data loss verification.** Walk every code path that writes or deletes any of the data tables. Confirm there is no path that drops, truncates, or unconditionally overwrites. The existing tables are real patient history; treat them as immutable except for additive writes the user explicitly authorized.
5. **Import flow review.** `/v2/import/*` is most likely to have destructive paths. Trace what happens when an import file conflicts with existing data: merge? overwrite? duplicate? Document the answer; do not change behavior unilaterally.
6. **Visual quality pass.** Tabular data is the hardest mobile design problem. Hold the surfaces against `docs/reference/oura/` (clean tabular density) and consider a "cards over tables" pattern for records if it improves readability without losing scanability.
7. **E2E.** Add tests that load each of the four routes and assert no horizontal overflow (`document.documentElement.scrollWidth <= window.innerWidth`), plus at least one happy-path test for opening a record detail. Run `npm run test:e2e`.

## Constraints

- ZERO data loss is the highest constraint. Never delete, truncate, or modify existing Supabase data without explicit user confirmation.
- Memory is HINTS, not GROUND TRUTH. Always verify recalled record state against live database queries before stating it.
- Per-day chunking in pgvector preserves temporal relationships - do not batch across days.
- Real patient data. No em-dashes.

## Deliverable

Feature branch with: the focused recording (binary gitignored, brief committed), the audit, the viewport diagnosis, the data-loss path review (written, not "fixed"), the import-conflict behavior write-up, in-scope visual fixes, and E2E. The data-loss review is more important than the visual pass; if you must trade, deliver the review.
