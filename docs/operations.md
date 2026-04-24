# Operations

Runbook material for keeping LanaeHealth production healthy.

## Error monitoring (Sentry)

Sentry is wired into the Next.js app to capture unhandled errors automatically
in production. The goal is to hear about issues before the user does.

### What is captured

- Server-side errors from route handlers, server components, and middleware
  (via `src/instrumentation.ts` `register()` hook + `onRequestError`).
- Client-side errors from the React tree (via `src/instrumentation-client.ts`
  and `src/app/global-error.tsx`).
- App Router error boundary catches (`src/app/error.tsx` now forwards to
  Sentry).

### What is NOT captured

- Performance traces. `tracesSampleRate` is 0 to stay under the free plan
  quota and avoid bundle bloat.
- Session replay. Replay would absolutely contain PHI in our case, so it is
  off entirely (`replaysSessionSampleRate: 0`).
- Request bodies. The PHI scrubber strips them before events leave the
  process.

### PHI scrubber

`src/lib/observability/sentry-scrubber.ts` runs in `beforeSend` for every
event. It redacts:

- Known PHI field names (medication, diagnosis, symptom, pain, cycle, food,
  lab, oura, etc.) recursively through extras, contexts, and breadcrumb
  data.
- Request body, cookies, query strings.
- Authorization and other secret headers.
- User identity (replaced with the literal string `patient`).

Tests in `src/lib/observability/sentry-scrubber.test.ts`. If you add a new
PHI-shaped field name in the database, also add it to `PHI_FIELD_NAMES` in
the scrubber.

### HIPAA caveat

The free Sentry tier is NOT a HIPAA Business Associate. We are using it
because Lanae is the only user of this app today, the scrubber strips the
obvious PHI vectors, and the value of catching errors before she reports
them outweighs the residual risk.

This becomes a blocker for productization. When the app opens to additional
users, do one of:

1. Upgrade to Sentry Business with a signed BAA.
2. Self-host Sentry on infrastructure we control.

The scrubber stays in place either way as defense in depth.

### Manual setup steps (one time)

After this PR merges, the user needs to:

1. Create a free Sentry account at https://sentry.io and create a project of
   type `Next.js`. Copy the DSN.
2. Add the following environment variables in the Vercel project settings
   (Project -> Settings -> Environment Variables), scoped to Production and
   Preview:
   - `SENTRY_DSN` -> server DSN from Sentry
   - `NEXT_PUBLIC_SENTRY_DSN` -> same DSN (the `NEXT_PUBLIC_` prefix is
     required for the browser bundle to read it)
   - `SENTRY_ORG` -> your Sentry org slug (for sourcemap upload)
   - `SENTRY_PROJECT` -> your Sentry project slug (for sourcemap upload)
   - `SENTRY_AUTH_TOKEN` -> auth token from Sentry settings, used at build
     time to upload sourcemaps. Without this, errors still capture but stack
     traces show minified code.
3. Trigger a redeploy so the new vars take effect.

If `SENTRY_DSN` is unset, the SDK silently no-ops. The build still succeeds
either way.

### Verification

After setup, hit the verification endpoint (Bearer token is the same
`HEALTH_SYNC_TOKEN` used elsewhere for service-to-service auth):

```
# Confirm config is present
curl -H "Authorization: Bearer $HEALTH_SYNC_TOKEN" \
  https://your-app.vercel.app/api/_health/sentry

# Send a test message (should appear in Sentry under Issues)
curl -H "Authorization: Bearer $HEALTH_SYNC_TOKEN" \
  "https://your-app.vercel.app/api/_health/sentry?action=message"

# Force a thrown error (should appear in Sentry as a captured exception)
curl -H "Authorization: Bearer $HEALTH_SYNC_TOKEN" \
  "https://your-app.vercel.app/api/_health/sentry?action=throw"
```
