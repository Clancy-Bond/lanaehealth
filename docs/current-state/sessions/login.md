# Session: Login / Auth surface

Owner: 2026-04-29 v2 Login session
Branch: this worktree (ecstatic-tharp-0c08f5)
Scope: the `/v2/login` route and its auth-only helpers. The legacy `/login`
is documented here for context; it is owned by the legacy Track A surface,
not this session.

## Caveat about source material

The original brief referenced `docs/current-state/frames/2026-04-29-app-tour/`
(frames 0050 to 0056). Those frames are not present in this worktree. Every
finding below is derived from the source code, the running dev server, and
the existing E2E specs. Where the brief made a frame-based observation
(notably the "numeric keyboard" question for frame 0055), the code-side
ground truth is reported and the frame discrepancy is flagged for the
user to verify visually.

## Route layout

There are **two** login surfaces in the app:

| Route | Pages | Owner |
|---|---|---|
| `/login` (legacy, single shared secret) | `src/app/login/page.tsx` + `src/app/login/LoginForm.tsx` | Track A, legacy Warm Modern palette. Out of scope for this session except as comparison. |
| `/v2/login` (multi-method Supabase Auth) | `src/app/v2/login/page.tsx` + `src/app/v2/login/LoginForm.tsx` | This session. |

Adjacent v2 auth surfaces (touched by this session if state coverage warrants):

- `/v2/signup` -> `src/app/v2/signup/page.tsx` + `src/app/v2/signup/SignupForm.tsx`
- `/v2/forgot-password` -> `src/app/v2/forgot-password/page.tsx` + `src/app/v2/forgot-password/ForgotPasswordForm.tsx`

Auth components consumed by `/v2/login` (editable in this session):

- `src/v2/components/auth/AppleSignInButton.tsx`
- `src/v2/components/auth/GoogleSignInButton.tsx`
- `src/v2/components/auth/PasskeySignInButton.tsx`
- `src/v2/components/auth/PasskeyRegistrationCard.tsx` (used post-login, not on `/v2/login` itself)

Server endpoints (locked: do not edit auth logic without user sign-off):

- `POST /api/auth/v2/login` -> `src/app/api/auth/v2/login/route.ts`
- `POST /api/auth/v2/signup` -> `src/app/api/auth/v2/signup/route.ts`
- `POST /api/auth/v2/forgot-password` -> `src/app/api/auth/v2/forgot-password/route.ts`
- `POST /api/auth/passkey/authenticate` -> `src/app/api/auth/passkey/authenticate/`
- `GET /auth/callback` -> Supabase OAuth code exchange (Apple, Google return here)

## Middleware behavior summary

File: `src/middleware.ts` (LOCKED for this session; changes via FOUNDATION-REQUEST only).

1. **Security headers run on every response**, including 401s. HSTS, CSP,
   `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
   `Cross-Origin-Opener-Policy: same-origin`, and a tight `Permissions-Policy`.
2. **Auth gate** is enabled by default. Set `LANAE_REQUIRE_AUTH=false` to
   bypass for local debugging. Playwright runs with the bypass on (see
   `playwright.config.ts:69`).
3. **Public routes** (no auth required): `/login`, `/v2/login`, `/v2/signup`,
   `/v2/forgot-password`, `/v2/legal/*`, `/share/*`, `/api/auth/v2/*`,
   `/api/auth/passkey/authenticate`, `/auth/callback`, `/api/health`, plus
   PWA shell assets.
4. **Service auth** (`Bearer` token or `x-vercel-cron: 1`) bypasses the gate
   so cron jobs and webhooks reach their handlers without a session cookie.
5. **Session detection** is presence-only. Middleware accepts any of:
   - `lh_session` cookie (Track A; configurable via `APP_SESSION_COOKIE_NAME`)
   - `lanae_session` cookie (legacy)
   - any cookie whose name starts with `sb-` and ends with `-auth-token` (Supabase)

   It does **not** validate the token value. Per-route `requireAuth()` does
   that.
6. **Unauthorized HTML requests** redirect to the v2 sign-in surface for
   `/v2/*` paths and to legacy `/login` for everything else, preserving the
   intended destination via `?returnTo=` (v2) or `?next=` (legacy).
7. **Unauthorized JSON requests** return `401 { error: "Unauthorized" }`.
8. The redirect target's query param is sanitized in the form (open-redirect
   prevention, see `safeReturn()` in `LoginForm.tsx:194` and `safeNext()` in
   the legacy `LoginForm.tsx:147`).

## What `/v2/login` actually renders

Source: `src/app/v2/login/LoginForm.tsx`.

Four sign-in methods stacked top to bottom inside a single `Card`:

1. **Continue with Apple** -> Supabase OAuth, `provider='apple'`, returns to `/auth/callback`.
2. **Continue with Google** -> Supabase OAuth, `provider='google'`, with `access_type=offline` and `prompt=consent`.
3. **Use a passkey** -> WebAuthn assertion via `@simplewebauthn/browser`, posted to `/api/auth/passkey/authenticate`. Hidden when `window.PublicKeyCredential` is not defined.
4. **Email + password** -> POST to `/api/auth/v2/login`, sets the SSR Supabase cookie on success.

Below the card:

- "Forgot password?" link -> `/v2/forgot-password`
- "New here? Create an account" link -> `/v2/signup` (preserves `returnTo` if non-default)

Optional banners at the top of the card:

- `?reset=1` query: shows a confirmation that the reset email was sent.
- `?error=<msg>` query: surfaces OAuth callback errors from `/auth/callback`.

## Viewport check (matches recording observation)

Captured against the running dev server at iPhone 13 Pro mini (375x812):

| Metric | Value |
|---|---|
| Viewport width | 375 |
| Document scrollWidth | 375 |
| Horizontal overflow | none |
| `window.PublicKeyCredential` available | true (preview Chrome) |

`/v2/login` is correctly bounded. The cream "explanatory" surface is not
in play here: the v2 login currently uses the dark `--v2-bg-primary`
(#0A0A0B) chrome, not the cream `--v2-surface-explanatory-*` palette. See
the audit doc for the visual-quality discussion.
