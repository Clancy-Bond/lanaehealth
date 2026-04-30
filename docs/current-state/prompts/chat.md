You are owning the **AI chat surface** of LanaeHealth's v2 mobile UI for this session.

**Blocked on:** `prompts/00-viewport-fix.md` must land first. Do not begin until the foundation viewport PR is merged to `main`. Confirm with `git log --oneline | grep -i "foundation: fix horizontal overflow"` before starting.

## Read first, in this order

1. `CLAUDE.md` (especially "Three-Layer Context Engine" and "Static/Dynamic Boundary Pattern").
2. `docs/current-state/INDEX.md`.
3. `docs/current-state/sessions/chat.md` (input sheet only - the doctor mode surface, frames 57-113, is owned by the doctors session).
4. `docs/current-state/known-issues.md`.
5. `docs/sessions/README.md`.
6. Frames: `docs/current-state/frames/2026-04-29-app-tour/frame_0001.png` through `frame_0004.png`.

## Your scope

The chat input sheet currently lives on Home (`/v2`) rather than at a dedicated route. Locate it with:

```
grep -rn "Hold to speak" src/app/v2 src/v2 src/components
grep -rn "How are you feeling" src/app/v2 src/v2 src/components
```

You may edit the chat composer component and any chat-only helpers. The shared primitives, `src/lib/context/**`, and `src/app/api/**` are locked. If you need a new route (e.g. `/v2/chat`), file a FOUNDATION-REQUEST first.

## What I want from this session

1. **Locate and document.** Find the chat composer files and add their paths to `docs/current-state/sessions/chat.md`. List every entry point that opens this sheet (Home tile, FAB, deep link, voice trigger).
2. **Interactivity audit.** Enumerate composer affordances: textarea, "Hold to speak" mic, Cancel, Save, predictive-text suggestion strip, attachments if any. File `docs/current-state/audits/chat.md` with element / location / exercised in recording? columns. Frame 0001 shows "How are you feeling?" with the H clipped at the left edge - flag whether that is an actual layout bug or a sheet-presentation animation artifact.
3. **Viewport bug check.** Per `known-issues.md` #1. Even if the composer itself is fine, the assistant response surface (which the recording does not show) likely renders markdown the same way doctor mode does and will exhibit the same overflow. Open the chat, send a message that elicits a long markdown reply with tables or long tokens (lab values, URLs, code), and check.
4. **Plumbing review (read-only).** Walk through `src/lib/context/assembler.ts`, `permanent-core.ts`, `summary-engine.ts`, `vector-store.ts`, `compaction.ts`, `handoff.ts`. Confirm the static/dynamic boundary is honored on every chat path. If you find a violation (dynamic state appearing before stable instructions, or instructions being interpolated rather than cached), do not fix it - file a FOUNDATION-REQUEST. The context engine is locked.
5. **Visual quality pass.** Hold the composer against the chrome of `docs/reference/oura/` (sheet patterns) and the voice of `docs/reference/natural-cycles/` (label copy). Implement deltas in scope.
6. **E2E.** At least one test that opens the composer, types a message, submits, and asserts a response renders. Run `npm run test:e2e`.

## Constraints

- Static/dynamic boundary is non-negotiable. Stable instructions FIRST.
- 9-section compaction template is the only allowed compression of chat history. No free-form summaries.
- Memory is HINTS, not GROUND TRUTH. The chat surface above all others must reflect this honestly.
- Real patient data. Treat every prompt and response with care.
- No em-dashes.

## Deliverable

Feature branch with: the located file paths added to the brief, the audit, the viewport diagnosis (or confirmed-clean note), any in-scope visual fixes, and at least one passing E2E. Read-only findings about the context engine go in a FOUNDATION-REQUEST PR, not your section's PR.
