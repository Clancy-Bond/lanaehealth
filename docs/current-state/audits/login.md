# Audit: `/v2/login`

Companion to `docs/current-state/sessions/login.md`. Source-derived; the
2026-04-29 app-tour frames are not present in this worktree, so where the
brief made a frame observation it is reconciled against the code below
and flagged for the user to verify visually.

## 1. Interactivity inventory

Every interactive element on `/v2/login`, in tab order. Source:
`src/app/v2/login/LoginForm.tsx` and the four buttons under
`src/v2/components/auth/`.

| # | Element | Type | Source | Notes |
|---|---|---|---|---|
| 1 | Continue with Apple | `<button type="button">` | `AppleSignInButton.tsx` | Black fill, white wordmark. Disables to busy state on click; Supabase OAuth redirect. |
| 2 | Continue with Google | `<button type="button">` | `GoogleSignInButton.tsx` | White fill, multi-color G mark. `access_type=offline`, `prompt=consent`. |
| 3 | Use a passkey | `<button type="button">` | `PasskeySignInButton.tsx` | **Conditional**: returns `null` when `window.PublicKeyCredential` is undefined. Renders below Google when available. Triggers WebAuthn assertion via `@simplewebauthn/browser`. |
| 4 | Divider "or" | `role="separator"` | `LoginForm.tsx:244` | Decorative, non-interactive. |
| 5 | Email field | `<input type="email">` | `Field` in `LoginForm.tsx:210` | `autoComplete="email"`. No autoFocus on this surface; the brief's autoFocus expectation belongs to legacy `/login`. |
| 6 | Password field | `<input type="password">` | `Field` in `LoginForm.tsx:210` | `autoComplete="current-password"`. **No `inputMode` attribute set** -- iOS shows the standard alphanumeric keyboard. See the numeric-keyboard finding below. |
| 7 | Sign in | `<button type="submit">` | `Button` primitive | Disabled when busy or when either of email / password is empty. Shows "Signing in..." while waiting on `/api/auth/v2/login`. |
| 8 | Error message | `role="alert"` paragraph | `LoginForm.tsx:158` | Not focusable, but announced by AT. Renders only when `errMsg` is set. |
| 9 | Forgot password? | `<Link>` | `LoginForm.tsx:172` | Routes to `/v2/forgot-password`. |
| 10 | Create an account | `<Link>` | `LoginForm.tsx:181` | Routes to `/v2/signup`, preserves `returnTo` when non-default. |

Confirmed via accessibility-tree snapshot of the running dev server: each
of items 1, 2, 5, 6, 7, 8 (when active), 9, 10 is reachable. Item 3 was
not in the snapshot at the moment of capture, but `window.PublicKeyCredential`
**is** defined in the preview Chrome (eval reported `hasPasskeyAPI: true`),
so the absence appears to be a render-timing artifact (the `useEffect` that
sets `supported = true` had not yet committed when the snapshot ran). The
existing E2E `v2-auth-comprehensive.spec.ts:25` reliably finds the passkey
button, so the runtime behavior is verified. No code change needed.

Affordances mentioned in the brief but **absent** from the recording and
confirmed absent from the source:

- Forgot-password link is **present** on `/v2/login`.
- Biometric / Face ID button is **present** but only as the WebAuthn
  passkey button, which is the right primitive on iOS.
- No "remember me" toggle. By design (Supabase session cookie persists
  per its own TTL).

## 2. Numeric keyboard finding (frame 0055)

**Source-side ground truth**: no `inputMode` attribute is set on any auth
surface input. Verified via:

```
grep -rn "inputMode\|inputmode" src/app/login src/app/v2/login \
    src/app/v2/signup src/app/v2/forgot-password \
    src/v2/components/auth
```

returns no matches. Both `/login` (legacy) and `/v2/login` use plain
`<input type="password">` with no `inputMode="numeric"` override.

Therefore, if frame 0055 in the recording shows iOS surfacing the numeric
or symbols keyboard when the password field has focus, the most likely
explanations are, in order:

1. **iOS Strong Password / Passwords app overlay**, which can show the
   numbers row pinned above the QWERTY keyboard. This is iOS chrome,
   not a code-side numeric keyboard.
2. The frame captured a moment when the user had toggled to the iOS
   numeric / symbols layer manually.
3. The frame was actually the legacy `/login` (which is also alphanumeric
   in code; same conclusion).

**Recommendation**: no code change. The current alphanumeric keyboard is
correct for a Supabase password field. If the user wants a numeric-only
PIN flow added later, that is a new feature and a security trade-off:
PINs reduce typing friction but cut the keyspace and cannot be the sole
factor for medical-data access. Flagging here so the user can decide
out-of-band.

This finding is reported only. **No behavior change is being made in
this session.**

## 3. State coverage

The form code paths through `setState('idle' | 'submitting' | 'error')`
plus the OAuth providers' own `busy` state and the WebAuthn flow's
`busy` state. Every state observed in source is enumerated below.

### 3a. States the UI handles today

| State | Code path | UX |
|---|---|---|
| Empty submit | Button is `disabled` while `!email \|\| !password` (`LoginForm.tsx:151`). Submit handler additionally guards `if (!email \|\| !password) return` (line 42). | Submit cannot fire. No visible error. |
| In flight | `state === 'submitting'`; button label switches to `Signing in...` and inputs are `disabled`. | Clear loading state. |
| Wrong email or password | `/api/auth/v2/login` returns 401 `{error: 'invalid credentials'}`. Form maps this to `Wrong email or password.` (line 53). | Friendly inline error in NC voice. |
| Server error / unknown | Any non-OK response other than the 401 maps to ``body.error ?? `Sign in failed (${res.status}).` ``. | Surfaces the server's message if present. |
| Network failure (fetch throws) | Catch block sets `errMsg` to `err.message ?? 'Network error.'`. | Friendly inline error. |
| OAuth provider not configured | `formatProviderError()` in Apple / Google buttons returns "Apple sign-in is not configured yet. We will turn it on as soon as the credentials are in place." | Honest, not blaming the user. |
| OAuth redirect not allowed | Different `formatProviderError()` branch suggests email + password fallback. | Useful nudge. |
| Passkey: no credential registered | Server returns 401 with friendly message; surfaced verbatim under the form. | Tells user where to go ("add one in Settings"). |
| Passkey: user cancelled OS prompt | `NotAllowedError` -> "No passkey was used. You can try again or sign in another way." | Soft. |
| OAuth callback error returned via `?error=` | `useEffect` on mount copies the param into `errMsg` (line 36). | Visible immediately on return from `/auth/callback`. |
| Successful reset email | `?reset=1` shows confirmation card above the form (line 101). | Persists across the form fade so the user does not lose context. |

### 3b. States the UI does **not** explicitly handle

These are gaps to discuss with the user before making any change. Most
require touching auth logic and are out of scope for this session unless
you sign off explicitly.

| Gap | What happens today | Suggested handling | Risk if untouched |
|---|---|---|---|
| **Locked / suspended account** | Supabase typically returns the same `invalid_credentials` shape, so we surface "Wrong email or password." which is misleading. | Detect the `User is banned` / `auth.account_suspended` error code in the API route and return a specific error string the form can display. **Touches auth logic; user sign-off required.** | User keeps retrying with correct password and gets confused. |
| **Email not confirmed** | If you ever enable email confirmation in Supabase, login returns `email_not_confirmed` and we currently show "Wrong email or password." | Distinct error and a "Resend confirmation" affordance. **Touches auth logic.** | Same confusion. |
| **Rate limit (429)** | We display ``Sign in failed (429).`` -- not friendly and does not tell the user to wait. | Detect 429 and show "Too many attempts. Try again in a minute." Pure UI, no auth-logic change. | Cosmetic but repeated 429 burns more attempts. |
| **MFA challenge** | Not configured. If turned on later, the current form silently treats the MFA challenge as a 200 and routes to `returnTo` even though no session is set. | Inspect the `data.session` shape and route to an MFA challenge view if needed. **Touches auth logic.** | Latent bug if MFA is enabled. |
| **Session-expired re-auth** | The middleware redirects to `/v2/login?returnTo=<path>`. The form picks up `returnTo` correctly, but there is no copy explaining "Your session expired." | Detect a `?reason=expired` query param and show a one-line banner. Pure UI. | User does not know why they were bounced. |
| **Provider not enabled at OAuth callback** | Surfaces via `?error=` query param. The error string is whatever Supabase returns; some are technical. | Add a small lookup map in `/auth/callback`'s redirect that maps known error codes to friendlier copy. **Touches auth logic.** | Confusing copy at the worst moment. |
| **Empty submit on already-disabled button** | Form is gated, so this is silent. No "Please fill both fields." copy. | Optional: helper text below empty fields after the user presses submit once. | Minor. Most users figure it out. |

Pure UI gaps that **do not** touch auth logic and that I am willing to
implement in this session, with user approval:

- 429 rate-limit copy
- Session-expired banner (driven by a `?reason=expired` query param the
  middleware would need to set; if middleware change is off-limits, the
  banner can also be triggered by an explicit logout reason cookie)
- Documentation of the state-coverage gaps in this file

The remaining items go in a separate PR labeled for explicit user review.

## 4. Viewport / known-issues check

Per the brief's reference to `known-issues.md` items #1 and #2 (file not
present in this worktree). Confirmed empirically via the running dev
server at iPhone 13 Pro mini (375 x 812):

- `document.scrollWidth === window.innerWidth` -> no horizontal overflow.
- `<main>` background is the dark Oura `--v2-bg-primary`. The Card and
  controls are correctly bounded within `maxWidth: 380` and centered.
- The form is taller than the 812 px viewport (`scrollHeight = 892`). That
  is expected: 4 sign-in buttons plus 2 inputs plus 2 footer links. Vertical
  scroll is allowed and not flagged as a bug.

The observation in the brief that "Login looks correctly sized in the
recording" matches the current code state. **No viewport fix needed on
this surface.** The post-login dark chrome bleed referenced in the brief
is not on this surface and is owned by the home / foundation session.

## 4a. First-visit cookie-banner overlap (newly surfaced)

While wiring up the state-coverage E2E I hit a Playwright failure that
also describes a real production bug:

`src/v2/components/CookieConsentBanner.tsx` renders a fixed-position
`role="region" aria-label="Cookie notice"` at `zIndex: 50` along the
bottom of the viewport. It is shown on first visit and dismissed via a
`Got it` click which writes `localStorage['v2-cookie-consent'] =
'acknowledged'`.

On `/v2/login` there is no bottom tab bar (the tab bar is AppShell-only
and AppShell is post-auth). The banner therefore sits very close to the
bottom edge of the viewport. On iPhone 13 Pro mini (375x812) with the
form vertically centered and the Sign in button near the bottom of the
form, the banner overlaps the button -- enough that a real first-time
user on iOS Safari may be unable to click `Sign in` without first
dismissing the banner.

Repro in Playwright on the WebKit project: a clean storage state means
the banner is shown; a `click()` on the Sign in button reports
`<div>...</div> from <div role="region" aria-label="Cookie notice">...
</div> subtree intercepts pointer events`.

Severity: low to medium. Users can scroll the banner away or tap
"Got it" first. But it is the kind of papercut that gets cited in
support tickets.

Suggested fix (does not touch auth logic):

- Hide the banner on the auth surfaces (`/v2/login`, `/v2/signup`,
  `/v2/forgot-password`). Cookie consent is only relevant once the user
  is in the app.
- Or raise the form container z-index above the banner so the banner
  visually stays but pointer events still reach the button.

I am holding off on this change for the same reason I held off on the
others -- it crosses the AppShell layout boundary and is the kind of
thing the foundation owner should sign off on. Documented here so the
next session catches it.

## 5. Visual quality pass against the explanatory palette

`CLAUDE.md` reserves `--v2-surface-explanatory-*` (cream, NC pink, plum
CTA) for "educational modals, onboarding, printable doctor summaries."
The login surface today uses the dark Oura chrome (`--v2-bg-primary` and
`--v2-text-primary`).

There are two defensible interpretations:

1. **Login is chrome.** It sits at the perimeter, not inside an
   "explanatory" context. Keeping it on the dark palette matches the
   home screen the user sees immediately after sign-in -- no jarring
   palette switch on success.
2. **Login is onboarding-adjacent.** New-user flow goes login -> signup
   -> first onboarding step. If onboarding is on the cream palette, the
   login feeling cream-on-cream too could be calming and consistent.

The current code lands on interpretation 1. CLAUDE.md does not strictly
forbid (or require) the change. **This is a design decision the user
should weigh in on, not something I will switch unilaterally.** Changing
it touches palette tokens (foundation), so it would also be a
FOUNDATION-REQUEST.

Smaller in-scope visual deltas the brief flagged (wordmark, lock icon,
primary button proportions):

| Delta | Current state | Suggested in-scope adjustment | Touches auth logic? |
|---|---|---|---|
| Wordmark | Legacy `/login` shows a "LanaeHealth" wordmark + lock emoji circle. `/v2/login` shows only "Welcome back" with no wordmark. | Optional: add a small wordmark above the heading on `/v2/login` for brand continuity from email link clicks. Pure markup change in `LoginForm.tsx`. | No |
| Lock icon | Same: present on `/login`, absent on `/v2/login`. | Optional: add a small lock or shield icon above the heading. | No |
| Primary button proportions | Sign in button is `<Button variant="primary" size="md" fullWidth>`. The OAuth and passkey buttons are `minHeight: 44`, `borderRadius: var(--v2-radius-full)`. The Sign in button uses the primitive's defaults, which may or may not match. | Open the demo page or inspect; if Sign in is shorter or less rounded than the OAuth buttons, align them. Pure styling change in `LoginForm.tsx` or the Button primitive (foundation if the latter). | No (if local), maybe (if primitive) |

I am holding off on these changes pending user direction (see "Open
questions for the user" at the bottom).

## 6. Voice and copy

NC-voice spot check: short, kind, explanatory, no jargon, no em-dashes.

- "Welcome back" -> matches.
- "Pick how you want to sign in. We never share your data with these
  providers." -> matches; the second sentence is reassuring without
  being preachy.
- "Sign in" / "Signing in..." -> matches.
- "Wrong email or password." -> matches; no blame, no ambiguity.
- "Forgot password?" -> matches.
- "New here? Create an account" -> matches.
- "Apple sign-in is not configured yet. We will turn it on as soon as
  the credentials are in place." -> matches; reframes a server error as
  a future promise.
- "No passkey is registered for this device. Sign in another way and add
  one in Settings." -> matches; tells the user where to go next.
- "Asking your device..." -> matches.
- "Password reset email sent. Open it on this device to choose a new
  password." -> matches.

No em-dashes anywhere. No jargon (we say "passkey", which is the right
common term, not "WebAuthn").

## 7. E2E coverage status

Existing specs that already cover this surface:

- `tests/e2e/v2-auth.spec.ts`
  - login renders Welcome heading, Sign in disabled until fields populated
  - signup parallel
- `tests/e2e/v2-auth-comprehensive.spec.ts`
  - login shows Apple, Google, passkey, email + password
  - signup shows Apple, Google, email + password (passkey hint instead)
  - Apple is black-fill, Google is white-fill (computed style check)
  - passkey + 401 path shows "no passkey is registered" copy

Gaps I propose to add in this session (no auth-logic changes):

1. Email + password 401 path renders "Wrong email or password." inline
   (route the request to a 401 stub).
2. Email + password network failure renders an inline error.
3. Returning users with `?reset=1` see the reset-email confirmation card.
4. `?error=foo` populates the inline error region on mount.
5. Viewport: at 375x812, `/v2/login` has no horizontal overflow
   (regression catch for the cream-on-cream issue documented elsewhere).

## Decisions made (2026-04-29 follow-up)

The user signed off on resolving everything in scope. Outcomes:

1. **Visual palette**: kept on dark Oura chrome. CLAUDE.md reserves
   `--v2-surface-explanatory-*` for "educational modals, onboarding,
   printable doctor summaries"; login is chrome, not explanatory.
   Switching to cream-on-cream would also create a jarring palette
   flip the moment the user lands on the dark home screen.
   No code change.
2. **Wordmark + lock icon**: added in `LoginForm.tsx`. Small ringed
   lock SVG above the heading, "LanaeHealth" wordmark in muted small
   caps below the icon, then "Welcome back". Brand continuity with
   the legacy `/login` and password-reset emails.
3. **Session-expired banner**: implemented as a `wasBounced` flag
   driven by the presence of `?returnTo=` (the middleware sets that
   only when it bounces an unauthenticated request). When set the
   form shows a small Card with "Sign in to continue to <path>".
   We do not claim "expired" because the UI cannot distinguish
   expiration from never-signed-in.
4. **Locked / email-not-confirmed / 429 copy**: implemented in
   `/api/auth/v2/login` (returns stable codes) and the `mapLoginError`
   helper in `LoginForm.tsx`. Codes covered: `invalid credentials`,
   `email_not_confirmed`, `user_banned`, `too_many_requests`,
   `mfa_required`, plus a status-fallback for unrecognized codes.
5. **MFA latent guard**: added in `/api/auth/v2/login`. If Supabase
   returns `data.user` without `data.session`, the route refuses the
   sign-in with the new `mfa_required` code rather than silently
   routing the user to `/v2` without a real session.

## Other fixes shipped at the same time

- **Cookie banner overlap (4a)**: hidden on `/v2/login`,
  `/v2/signup`, `/v2/forgot-password` via a `usePathname()` guard
  in `CookieConsentBanner.tsx`. The banner re-appears the first
  time the user lands inside the app.
- **`/auth/callback` 5xx bug**: `exchangeCodeForSession` throws
  (rather than returning `{ error }`) when the PKCE code_verifier
  cookie is missing -- a real iOS Safari ITP failure mode. The
  callback now wraps the whole Supabase interaction in try/catch
  and always redirects back to `/v2/login` with a readable
  `?error=` instead of serving 500. New E2E spec at
  `tests/e2e/v2-auth-callback.spec.ts` enforces "never 5xx".

## Provider configuration (out of code scope)

If "Continue with Apple" or "Continue with Google" still does not
start the OAuth flow even after the fixes above, the cause is in
the Supabase project config, not the codebase. Things to verify
in the Supabase dashboard:

- Apple Sign In and Google providers are enabled under
  Authentication -> Providers.
- The "Site URL" matches the deployed `NEXT_PUBLIC_APP_URL`.
- The "Redirect URLs" allowlist includes `<app>/auth/callback` for
  every domain the app is reachable from (production, preview,
  local dev when testing OAuth).
- For Apple specifically: the Service ID, Team ID, Key ID, and
  private key must be filled in. Apple Sign In also requires the
  email relay service to be set up if you want
  `apple.com` private-relay addresses to deliver mail.
- For Google: client ID and secret must be present, and the OAuth
  consent screen must be at least in "Testing" with the test user
  list including the patient.

When the provider is mis-configured, our `formatProviderError()` in
`AppleSignInButton.tsx` and `GoogleSignInButton.tsx` translates the
raw Supabase error into NC voice ("Apple sign-in is not configured
yet ..."). Now that the callback no longer 500s, that error path is
reachable in all cases instead of being eaten by a server error.
