You are owning the **Doctor mode (diagnostic analysis output)** surface of LanaeHealth's v2 mobile UI for this session.

**Blocked on:** `prompts/00-viewport-fix.md` must land first. Do not begin until the foundation viewport PR is merged to `main`. Confirm with `git log --oneline | grep -i "foundation: fix horizontal overflow"` before starting.

## Read first, in this order

1. `CLAUDE.md` (especially "Three-Layer Context Engine", "Static/Dynamic Boundary Pattern", and the "self-distrust principle").
2. `docs/current-state/INDEX.md`.
3. `docs/current-state/sessions/doctors.md` - this is your primary brief and it is detailed because the recording spends 57+ frames on this surface.
4. `docs/current-state/known-issues.md` - **most critical for this session**. The viewport bug is most visible on doctor mode and likely lives in the markdown rendering used here.
5. `docs/sessions/README.md`.
6. Frames: `docs/current-state/frames/2026-04-29-app-tour/frame_0057.png` through `frame_0113.png`.

## Your scope

`src/app/v2/doctor/**`. Anything outside is locked. The markdown rendering primitive is likely in `src/v2/components/primitives/**` (or shell), which means **the viewport bug fix is almost certainly a FOUNDATION-REQUEST**, not a section-local change.

## What I want from this session

1. **Confirm the viewport fix held on doctor mode.** The Priority 0 foundation pass should have eliminated the horizontal-overflow bug that hit hardest here. Walk every doctor route on a 390px-wide viewport and confirm `document.documentElement.scrollWidth <= window.innerWidth + 1`. If anything still overflows, that is a regression - file it back to whoever owned `prompts/00-viewport-fix.md` rather than patching it locally.
2. **Interactivity audit.** Frame 0105 shows tab-like affordances at the bottom: "Hypotheses", "Next actions", a "Show this?" link, and what looks like a teal chat bubble with a prefilled question. Are these tabs? Filters? Quick-question shortcuts to the AI chat? Read the source and document. File `docs/current-state/audits/doctors.md`.
3. **Self-distrust prelude.** The "Data Limitations First" block (frame 0057) explicitly states "all dynamic data streams are currently at 0% for the recent window, no Oura biometrics, no daily symptom logs, no food diary, no cycle tracking." This is the self-distrust principle made user-visible and must be preserved through any redesign. Do not collapse it behind an info icon. Do not move it below the fold. Do not soften the wording.
4. **Drill-in detail page.** The current surface presents 6 hypotheses inline with all their evidence. The brief notes there is no per-hypothesis detail page. Decide whether this is a feature gap worth proposing (request user input before building - this is a meaningful product decision, not a layout fix).
5. **Visual quality pass.** Hold the page against `docs/reference/oura/` for chrome and `docs/reference/natural-cycles/` for explanatory voice. The current dense markdown is hard to scan; better hierarchy is plausible without losing the rigor.
6. **E2E.** Add coverage that loads the doctor page, asserts a hypothesis card renders without horizontal overflow (use `page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)`), and asserts the Data Limitations prelude is visible above the first hypothesis. Run `npm run test:e2e`.

## Constraints

- Static/dynamic boundary is critical here. The hypothesis output is generated through the Context Assembler; do not touch `src/lib/context/**`.
- 9-section compaction applies if you touch any chat history compression.
- Memory is HINTS - the analysis must reflect uncertainty, not pretend to be ground truth.
- Real patient data. Hypothesis scores and lab values are sensitive. No em-dashes.

## Deliverable

A FOUNDATION-REQUEST PR for the viewport bug fix (highest value of this session) plus a feature branch for in-scope work: audit, drill-in proposal (or the implementation if the user signed off), visual pass, E2E. The viewport bug fix is the single most user-impactful improvement in this entire app right now; treat it accordingly.
