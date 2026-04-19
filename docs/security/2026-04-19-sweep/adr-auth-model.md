# ADR: Auth model for LanaeHealth

**Date:** 2026-04-19
**Status:** Accepted (Track A, security sweep 2026-04-19)
**Authors:** Session A (Claude Code, web)

---

## Context

LanaeHealth is a single-patient medical-data app. Today, most API routes
have no authentication. The Supabase public anon key is used for reads
from the browser, and the service-role key is used liberally for both
reads and writes. Two existing routes already use ad-hoc Bearer-token
checks (`/api/admin/apply-migration-011`, `/api/admin/apply-migration-013`,
`/api/privacy-prefs` PATCH, `/api/export/full`, `/api/share/care-card`)
but each uses a different env var and none is constant-time. There is
no middleware.

## Constraints

- Single known end-user (the patient). Multi-tenant scoping is not
  required.
- PWA/browser + iOS Shortcut + Vercel cron are the three client
  categories.
- Zero data-loss rule (CLAUDE.md): auth mistakes must fail closed, not
  lock the patient out of her own data.
- Must not block Tracks B/C/D that already depend on `requireUser()`.
- Sweep time budget is hours, not weeks: Supabase Auth (magic link +
  email OTP) is out of scope for this sweep.

## Decision

Ship a single shared-secret auth primitive, `requireAuth(req)`, backed
by two env vars:

- `APP_AUTH_TOKEN` — high-entropy random string (at least 32 bytes
  base64, generate with `openssl rand -base64 32`). Shared across all
  authenticated surfaces.
- `APP_SESSION_COOKIE_NAME` (optional, default `lh_session`) — name of
  the cookie set by the browser login flow.

### Two supported credential types

1. **Bearer header:** `Authorization: Bearer <APP_AUTH_TOKEN>`.
   Used by the iOS Shortcut, CLI tools, and any server-to-server call.
2. **Session cookie:** `lh_session=<APP_AUTH_TOKEN>`.
   Set by `POST /api/auth/login` after a password check (below).
   `HttpOnly`, `Secure`, `SameSite=Strict`, 30-day expiry.

Both paths compare against `APP_AUTH_TOKEN` using
`crypto.timingSafeEqual` to avoid timing oracles.

### Login flow (browser)

- `POST /api/auth/login` accepts `{ password: string }`.
- Server compares password to `APP_AUTH_PASSWORD` via
  `crypto.timingSafeEqual`. If match, set `lh_session` cookie with
  value `APP_AUTH_TOKEN`. Never reveal the password check result
  through timing or verbose errors.
- `POST /api/auth/logout` clears the cookie.
- Middleware (Track D) redirects unauthenticated browser traffic to
  a `/login` page that POSTs to this route.

### Deprecation of ad-hoc tokens

Existing per-route tokens (`PRIVACY_ADMIN_TOKEN`, the service-role
Bearer pattern in admin migration routes) are folded into
`requireAuth`. The individual env vars are retained for one release
as fallbacks, then removed.

Track A retires the service-role-as-Bearer pattern in the admin
migration routes immediately, because it both (a) compares
non-constantly and (b) conflates the DB superkey with an API auth
token.

### RLS stance

Because the app is single-patient and `requireAuth` protects every
state-mutating endpoint, RLS is used as defense-in-depth rather than
as the primary authorization boundary. Migration `027_rls_sweep.sql`
enables RLS on every table that doesn't have it yet and adds a single
`authenticated`-role policy. The app continues to use the service
client for writes; RLS catches mistakes if a future route
accidentally reaches for the anon client.

## Alternatives considered

- **Supabase Auth (magic link / OTP / email + password):** strongest
  long-term answer. Adds email provider setup, two new tables
  (`auth.users`, `auth.sessions`), and per-route code to read the
  JWT. Out of scope for this sweep. Filed as future work.
- **Vercel Password Protection:** blocks the browser preview domain
  but does not gate API routes called directly. Useful belt-and-
  suspenders on the preview URL, not a complete solution.
- **Row-level policies keyed by `auth.uid()`:** requires Supabase Auth
  and is pointless in a single-patient app.
- **No auth, rely on obscurity:** what today does. Untenable. Routes
  are discoverable from the JS bundle.

## Consequences

Positive:

- One well-audited function handles every auth check.
- Constant-time comparison throughout.
- Browser and API-client flows unified.
- Token rotation is a single env-var change, no code edits.

Negative:

- Shared secret is a single point of compromise. Mitigation: rotate
  on any suspected leak, log every auth failure, rate-limit the
  login endpoint.
- No per-session revocation (only global rotation). Acceptable given
  single-user threat model.
- No MFA. Acceptable for v1; revisit if threat model changes.

## Rotation procedure

1. Generate a new token: `openssl rand -base64 32`.
2. Update `APP_AUTH_TOKEN` in Vercel env (Production + Preview).
3. Update the same value in the iOS Shortcut config.
4. Redeploy.
5. Log out of any browser session; log back in with
   `APP_AUTH_PASSWORD` which sets a fresh cookie bound to the new
   token.
6. Grep Vercel logs for 401 spikes that imply a dropped integration.

If the token itself is suspected leaked (e.g., captured in a log, in
a screenshot, in a git history commit): rotate within 1 hour.

## Environment variables summary

| Var                     | Purpose                                | Scope          |
|-------------------------|----------------------------------------|----------------|
| `APP_AUTH_TOKEN`        | The shared secret all routes accept    | Server-only    |
| `APP_AUTH_PASSWORD`     | Browser login password                 | Server-only    |
| `APP_SESSION_COOKIE_NAME` | Optional cookie name override        | Server-only    |
| `PRIVACY_ADMIN_TOKEN`   | (deprecated) legacy privacy-prefs only | Server-only    |
| `CRON_SECRET`           | Vercel cron auth (Track C owns)        | Server-only    |

All are `process.env`-only; none are `NEXT_PUBLIC_*`.
