# Sentry / Observability Audit - 2026-04-26

Author: end-to-end Sentry verification pass.
Branch: claude/sentry-verify.
Scope: confirm Sentry actually captures errors in production, plug
observability gaps, and add tracing to the seven hottest v2 paths.

## TL;DR

- Code is wired correctly. `withSentryConfig`, runtime `register()`,
  client init, `error.tsx`, `global-error.tsx`, PHI scrubber, and a
  pre-existing `/api/_health/sentry?action=throw` endpoint are all in
  place.
- **The Vercel production environment has ZERO Sentry env vars set.**
  `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`,
  `SENTRY_ORG`, `SENTRY_PROJECT`. Sentry is silently no-op in
  production. Until those are set, no events are captured anywhere.
- Tracing was off (`tracesSampleRate: 0`). Tracing wrappers are now
  added on seven critical paths so flipping that one number to (e.g.)
  0.1 immediately gives latency breakdowns without touching call sites.
- Structured logging (`src/lib/observability/log.ts`) emits one JSON
  line to stderr per error so Vercel captures errors even when Sentry
  is not configured. This is the primary fallback.

## Current Sentry status

| Layer                | State        | Notes                                                           |
| -------------------- | ------------ | --------------------------------------------------------------- |
| Build wrapper        | wired        | `next.config.ts` calls `withSentryConfig(...)`.                 |
| Server runtime init  | wired        | `src/instrumentation.ts` calls `Sentry.init` for nodejs + edge. |
| Client runtime init  | wired        | `src/instrumentation-client.ts` calls `Sentry.init`.            |
| App-router boundary  | wired        | `error.tsx` and `global-error.tsx` call `captureException`.     |
| PHI scrubber         | wired        | `src/lib/observability/sentry-scrubber.ts` redacts known keys.  |
| Tracing              | wrappers in  | `tracesSampleRate` still `0`. See "How to turn on tracing".     |
| Replay               | off          | Intentional. Session video would capture PHI.                   |
| Source maps          | not uploaded | `SENTRY_AUTH_TOKEN` unset on Vercel.                            |
| **Production capture** | **OFF**    | **`SENTRY_DSN` unset. Sentry init no-ops, no events sent.**     |

## What is now instrumented

### Test endpoint

- `POST /api/test/sentry-error` (gated by `SENTRY_TEST_TOKEN` Bearer).
  Throws an `Error` whose message contains the marker tag
  `lanaehealth-sentry-test-2026-04-26`, calls `Sentry.captureException`,
  and forwards through `logError()` so the structured log line still
  appears even when Sentry is no-op.
- Companion endpoint already existed:
  `GET /api/_health/sentry?action=throw|message` (gated by
  `HEALTH_SYNC_TOKEN`).

### Structured logger

- `src/lib/observability/log.ts` exports `logError({ context, error, tags })`
  and `logWarn(...)`. Writes one JSON line to stderr (`{ level, ts,
  context, message, stack, tags }`) and forwards to Sentry. Vercel
  captures stderr automatically and exposes it in the dashboard with
  full-text search, so this works as a Sentry fallback.
- Wired into the catch blocks of every traced path below.

### Tracing helper

- `src/lib/observability/tracing.ts` exports
  `trace({ name, op, attributes }, async () => ...)`. Thin wrapper
  around `Sentry.startSpan`. When tracing is off it still calls the
  inner function, so the wrapping is free in the no-op state.

### Tracing wrappers added (7 critical paths)

| Path                                | Span name                       | Op                    |
| ----------------------------------- | ------------------------------- | --------------------- |
| `POST /api/cycle/log`               | POST /api/cycle/log             | http.server           |
| `POST /api/food/log`                | POST /api/food/log              | http.server           |
| `POST /api/chat`                    | POST /api/chat                  | ai.chat_completion    |
| `POST /api/v2/corrections`          | POST /api/v2/corrections        | http.server           |
| `POST /api/cron/notifications`      | POST /api/cron/notifications    | cron                  |
| `assembleDynamicContext()`          | assembleDynamicContext          | ai.context_assemble   |
| `loadCycleContext()`                | loadCycleContext                | function              |

Note: the original task referenced `assembleContext` and
`/api/v2/chat`. The actual function is `assembleDynamicContext` (only
exported orchestrator in `src/lib/context/assembler.ts`) and chat lives
at `/api/chat`. No `/api/v2/chat` route exists.

## What is NOT instrumented (and why)

- **Inner Anthropic loop iterations.** Wrapping each tool-use round
  inside the chat handler would explode span count for a feature that
  is not yet performance-critical. Add later when the per-iteration
  latency story matters.
- **Read-only RSC data loaders other than `loadCycleContext`.** Most
  v2 RSCs hit Supabase once and render. Instrumenting them all would
  bloat traces; we will add wrappers as specific bottlenecks emerge.
- **Static assets / middleware.** Middleware runs before the runtime
  init in the edge runtime; tracing it requires a different approach
  via the OpenTelemetry plugin.
- **PostHog / analytics.** Out of scope for this pass.

## How to turn Sentry ON for production

The wiring is ready. The remaining steps are env config:

```bash
# Required to capture anything at all.
vercel env add SENTRY_DSN production            # value from sentry.io project
vercel env add NEXT_PUBLIC_SENTRY_DSN production # same DSN, public-prefixed for browser

# Required to upload source maps so stack traces are readable.
vercel env add SENTRY_AUTH_TOKEN production    # https://sentry.io/settings/account/api/auth-tokens/
vercel env add SENTRY_ORG production           # your Sentry org slug
vercel env add SENTRY_PROJECT production       # your Sentry project slug
```

Then redeploy:

```bash
vercel --prod
```

Optional: set a token to authorize test calls:

```bash
vercel env add SENTRY_TEST_TOKEN production    # any random opaque secret
```

## How to verify capture end-to-end

1. Set `SENTRY_TEST_TOKEN` (and `SENTRY_DSN`) on the production env.
2. Redeploy.
3. Trigger the test:

```bash
curl -X POST \
  -H "Authorization: Bearer $SENTRY_TEST_TOKEN" \
  https://lanaehealth.com/api/test/sentry-error
```

4. In Sentry, search Issues for the literal string
   `lanaehealth-sentry-test-2026-04-26` or filter by the tag
   `test_marker`. The event must appear within ~30 seconds.
5. If it does NOT appear, check Vercel logs for the JSON line tagged
   `"context":"api/test/sentry-error"`. If the JSON line is there and
   Sentry is empty, the DSN is wrong or the project is wrong.

## How to turn tracing on

After verifying error capture works, change one number:

```ts
// src/instrumentation.ts (server + edge)
tracesSampleRate: 0.1, // was 0; sample 10% of requests
```

```ts
// src/instrumentation-client.ts (browser)
tracesSampleRate: 0.05, // browser bundle weight; keep low
```

The seven traced paths above will start showing latency breakdowns in
the Sentry Performance tab without any further code changes.

## PHI hygiene posture

The scrubber in `src/lib/observability/sentry-scrubber.ts` is the
defensive layer. Key facts:

- Free Sentry tier is **not** a HIPAA Business Associate. Acceptable
  only because Lanae is the sole user during this phase. When opening
  to additional users, either upgrade to Business with a signed BAA
  or self-host. The scrubber stays in place either way.
- The scrubber drops request bodies, query strings, cookies, auth
  headers, and any field whose key matches a PHI substring.
- The structured logger does NOT scrub. Callers must keep PHI out of
  `tags` and `context`. The `error.message` of a postgres error can
  echo a column value into the log; treat the log line as PII.

## Files touched this pass

```
src/lib/observability/log.ts             (new)
src/lib/observability/tracing.ts         (new)
src/app/api/test/sentry-error/route.ts   (new)
docs/research/sentry-observability-2026-04-26.md (new)

src/app/api/cycle/log/route.ts           (trace + logError)
src/app/api/food/log/route.ts            (trace + logError)
src/app/api/chat/route.ts                (trace + logError)
src/app/api/v2/corrections/route.ts      (trace + logError)
src/app/api/cron/notifications/route.ts  (trace + logError)
src/lib/context/assembler.ts             (trace on assembleDynamicContext)
src/lib/cycle/load-cycle-context.ts      (trace on loadCycleContext)
```
