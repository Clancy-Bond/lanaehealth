---
date: 2026-04-16
agent: R5
area: mutations
status: FIXED
severity: HIGH
verification_method: static-analysis + vitest
fixed_by: IMPL-W2B-6
fixed_date: 2026-04-17
---

# `PUT /api/profile` stringifies content; other writers store it as an object

## One-sentence finding
`/api/profile` PUT wrote `content: JSON.stringify(body.content)` into `health_profile`, while other endpoints (universal importer, myah importer) wrote `content` as a JS object; since the column is `jsonb`, the two shapes produced legacy rows that break direct `row.content.someField` access.

## Expected
All writers to `health_profile.content` use the same encoding. The column is `jsonb` so the writer should pass the object directly -- Supabase serializes it natively.

## Actual (pre-fix)
Divergent writers:

`src/app/api/profile/route.ts` line 33 (PUT):
```ts
content: JSON.stringify(body.content),
```

`src/app/api/import/universal/route.ts` (allergy case) and `src/app/api/import/myah/route.ts` (medications case) passed raw objects.

Consumers that did `(profile?.content as Record<string, unknown>)?.items` returned `undefined` when the column stored a double-encoded string.

## Verification evidence
Static diff of the three writers. New vitest `src/lib/__tests__/profile/parse-content.test.ts` exercises all three input shapes (raw object, JSON-stringified object, non-JSON string) and the array/primitive passthrough cases. Full suite: 338 / 340 passing (two pre-existing failures unrelated to this fix).

## Resolution (FIX-FORWARD ONLY, zero data loss)

LOCKED DECISION: Do not mutate existing rows. Legacy JSON-stringified rows coexist with raw jsonb rows indefinitely; every reader normalizes via a shared parser.

1. `src/app/api/profile/route.ts` -- removed `JSON.stringify(body.content)`; PUT now upserts the raw object. New writes will land as native jsonb.
2. NEW `src/lib/profile/parse-content.ts` -- shared `parseProfileContent(raw: unknown): unknown` helper. If input is a string, try `JSON.parse`; on failure, return the string; otherwise return the value unchanged.
3. Readers updated to route `row.content` through `parseProfileContent(...)`:
   - `src/lib/context/permanent-core.ts` (inside the shared `profileMap` helper, covers both `getPermanentCoreText` and `getPermanentCoreStructured`)
   - `src/app/profile/page.tsx` (server component that feeds `ProfileClient`)
   - `src/app/doctor/page.tsx` (inside the shared `profileMap` helper)
   - `src/lib/reports/cycle-report.ts` (cycle report builder)
   - `src/lib/ai/chat-tools.ts` -- `getHealthProfile()` (Claude tool response)
   - `src/lib/context/summary-engine.ts` (case `'health_profile'` in `fetchDataSource`)
   - `src/lib/intelligence/personas/hypothesis-doctor.ts` (formatSection for health_profile)
   - `src/lib/intelligence/personas/clinical-analyst.ts` (formatSection for health_profile)
   - `src/lib/log/prefill.ts` (`extractMeds` helper)
   - `src/app/api/import/universal/route.ts` (allergy case reads existing content)
   - `src/app/api/import/myah/route.ts` (medications case reads existing content)
4. NEW vitest `src/lib/__tests__/profile/parse-content.test.ts` with 4 cases: raw object identity, JSON-stringified object parsed back, non-JSON string passthrough, and array/primitive passthrough.

## Legacy-shape coexistence

Existing rows written by the old PUT handler remain as JSON-stringified strings in the jsonb column. This is intentional (Zero Data Loss). The parser handles both shapes indefinitely. A one-off cleanup migration (`UPDATE health_profile SET content = content::jsonb WHERE jsonb_typeof(content) = 'string' AND left(content::text, 1) = '"'` with safety checks) is queued for Wave 3 and requires human approval before running.

## Not modified (by design)
- `src/app/api/export/route.ts` already handles both shapes when extracting the patient name, and the raw dump of `healthProfile.data` into the export is a deliberate reflection of DB storage state (it's a backup).
- `src/app/api/context/test/route.ts` only issues COUNT queries against `health_profile`; no content is read.
- The `.mjs` migration scripts under `src/lib/migrations/` touch only their own legacy rows and are one-shot; not routed through the new parser.
