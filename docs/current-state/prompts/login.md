You are owning the **Login / Auth surface** of LanaeHealth's v2 mobile UI for this session.

**Blocked on:** `prompts/00-viewport-fix.md` must land first. Do not begin until the foundation viewport PR is merged to `main`. Confirm with `git log --oneline | grep -i "foundation: fix horizontal overflow"` before starting.

## Read first, in this order

1. `CLAUDE.md` (especially "Critical Rules" - this is real patient data and a high-stakes surface).
2. `docs/current-state/INDEX.md`.
3. `docs/current-state/sessions/login.md`.
4. `docs/current-state/known-issues.md`.
5. `docs/sessions/README.md`.
6. Frames: `docs/current-state/frames/2026-04-29-app-tour/frame_0050.png` through `frame_0056.png`. Frames 0047-0049 are blank transition frames; ignore.
7. The middleware: `src/middleware.ts`.

## Your scope

Locate the auth UI with:

```
grep -rn "Sign in to continue" src/app
grep -rn "LANAE_REQUIRE_AUTH" src
grep -rn "from 'next/navigation'" src/app/login src/app/auth 2>/dev/null
```

You may edit the login route component and any auth-only helpers. `src/middleware.ts` is shared infrastructure; treat it as locked unless the user explicitly approves a change.

## What I want from this session

1. **Document the route layout.** Add the file paths and the middleware behavior summary to `docs/current-state/sessions/login.md`.
2. **Interactivity audit.** Enumerate every interactive element on the login screen: password field, Sign in button, any forgot-password / passkey / biometric affordance the source mentions but the recording did not surface. File `docs/current-state/audits/login.md`.
3. **Numeric keyboard question.** Frame 0055 shows iOS surfacing the numeric/symbols keyboard when the password field has focus. Confirm whether the field has `inputMode="numeric"` set, and whether that is intentional (numeric-only PIN) or a bug (should accept full alphanumeric). Report findings; do not change behavior unilaterally - this is a security-adjacent surface and the user should sign off.
4. **Viewport bug check.** Per `known-issues.md` #1 and #2. Login looks correctly sized in the recording. Confirm by running locally. If the cream "explanatory" surface is correctly bounded but the dark post-login chrome bleeds laterally, that is owned by the home/foundation session, not yours.
5. **Empty state and error states.** The recording shows "Sign in" and "Signing in..." only. List the other states the login screen should handle: empty field submit, wrong password, network failure, locked account, session-expired re-auth. For each, check if the current code handles it; if not, document the gap. Do not implement fixes that touch authentication logic without user approval.
6. **Visual quality pass.** Hold the screen against the cream-on-cream Warm Modern explanatory palette (`--v2-surface-explanatory-*`). The wordmark, lock icon, and primary button proportions are the only obvious deltas.
7. **E2E.** Confirm the existing auth E2E in `tests/e2e/` (per CLAUDE.md, login + signup baselines exist). Add coverage for any new state or copy you introduce. Run `npm run test:e2e`.

## Constraints

- Auth is a Prohibited Actions surface for some operations. You **may** improve UI / copy / styling. You **may not** change auth logic, session handling, or password validation without explicit user confirmation.
- No new account creation flows. Single-user app.
- No SSO / OAuth flows added without user approval.
- Real patient data. No em-dashes.

## Deliverable

Feature branch with: paths and middleware notes in the brief, audit, numeric-keyboard finding written up (no code change), state-coverage gap document, in-scope visual fixes, and any added E2E. Anything touching auth logic goes in a separate PR labeled for explicit user review.
