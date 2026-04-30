# Current state: Login / Auth flow

**Recording:** `docs/current-state/recordings/2026-04-29-app-tour.mp4`
**Frames:** `docs/current-state/frames/2026-04-29-app-tour/frame_0050.png` through `frame_0056.png`. Frames 0047-0049 are mostly blank transition frames; safe to ignore for curation but they confirm the navigation took the user out of the authenticated shell briefly.

## What is on screen today

- **Single-screen password sign-in.** A circular grey lock-icon avatar sits centered. Below it: the wordmark "LanaeHealth" in a heavy serif/semi-serif and the subhead "Sign in to continue" in muted grey. A white card holds a single field labeled "PASSWORD" (8 dots visible, masked) and a sage-green primary button "Sign in" / "Signing in..." in the loading state.
- **Numeric keyboard.** When the field has focus, iOS surfaces the numeric/symbols keyboard (suggesting the password field is set to a numeric input mode, or iOS is autofilling from saved passwords). Worth confirming whether this is intentional.
- **Background.** Cream-cream surface (the explanatory palette `--v2-surface-explanatory-*`), distinct from the dark Oura-derived chrome used post-login.
- **No email field, no SSO, no signup.** This is a single-account authenticated experience.

## Architectural context

- The middleware (`src/middleware.ts`) gates `/v2` behind a session cookie.
- For E2E tests, the Playwright config boots the dev server with `LANAE_REQUIRE_AUTH=false` (see CLAUDE.md "E2E Testing"). Per-route authorization tests live elsewhere.
- This is "REAL patient's medical data" (CLAUDE.md "Critical Rules"); changes to the auth surface are high-stakes. Always confirm with the user before any logout, signup, or session-handling change.

## Routes that own this surface

Find the login route with:

```
grep -rn "Sign in to continue" src/app 2>/dev/null
grep -rn "LANAE_REQUIRE_AUTH" src 2>/dev/null
```

If the auth UI lives outside `/v2`, an Auth session needs FOUNDATION-REQUEST before touching shared shell components.

## Known gaps in this recording

- No signup flow (none exists; single user).
- No password reset.
- No biometric / passkey (the Settings frame mentions "passkey" support is conditional on Safari iOS or Chrome).
- No logout transition shown except the implicit Settings -> "Sign out" affordance at frame 0032.
