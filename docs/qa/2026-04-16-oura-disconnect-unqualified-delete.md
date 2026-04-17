---
date: 2026-04-16
agent: R5
area: mutations
status: FIXED
severity: HIGH
verification_method: static-analysis
---

# `/api/oura/disconnect` issues an unqualified `.delete().neq('id', zero-uuid)` on `oura_tokens`

## One-sentence finding
`disconnectOura()` deleted every row in `oura_tokens` using `.neq('id', '00000000-0000-0000-0000-000000000000')`, a blanket delete disguised as a scoped filter that violated the Zero Data Loss principle if the schema ever becomes multi-patient. The same anti-pattern was also used inside `storeTokens()` to clear prior rows before inserting a fresh token.

## Expected
The delete should be unambiguously scoped. For a single-patient app the safest pattern is to look up the specific token rows first and then delete them by id so that intent matches the query, no magic-uuid sentinel required.

## Actual (before fix)
`src/lib/oura.ts` contained two copies of the anti-pattern:

```ts
// storeTokens() -- before insert
await supabase.from('oura_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000')

// disconnectOura()
await supabase.from('oura_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000')
```

`/api/oura/disconnect/route.ts` simply called `disconnectOura()`, so the route inherited the same behaviour. The sibling `/api/integrations/[integrationId]/disconnect/route.ts` uses `deleteToken(integrationId)` in `src/lib/integrations/hub.ts`, which is already scoped by `integration_id` and does not need changing.

## Verification evidence
Pre-existing source (now replaced): `src/lib/oura.ts:84` and `src/lib/oura.ts:216`.

Static cross-check of the sibling route `src/app/api/integrations/[integrationId]/disconnect/route.ts` confirms it relies on `deleteToken()` which issues `.delete().eq('integration_id', integrationId)` -- already safe, no change required.

## Recommended action
- FIX `src/lib/oura.ts`: replace both `.neq('id', zero-uuid)` deletes with a two-step "select ids, then delete by id" pattern. Added commentary explains the intent.
- TEST: vitest `src/lib/__tests__/oura-disconnect.test.ts` mocks the Supabase client and asserts:
  1. `disconnectOura()` calls `.select('id')` then `.delete().in('id', [...])` against `oura_tokens`.
  2. `disconnectOura()` never issues `.neq('id', ...)`.
  3. `disconnectOura()` is a no-op when no rows exist.
  4. `storeTokens()` follows the same scoped-delete pattern and skips the delete step when no prior rows exist.

## Files changed
- `src/lib/oura.ts` -- rewrote both `.delete().neq(...)` calls; added docstrings.
- `src/lib/__tests__/oura-disconnect.test.ts` -- new regression test (4 cases, all passing).

## Status
FIXED in QA Session 2 Wave 2 (W2.12). Scoped vitest run: 4 passed. Full suite: 287 pass / 2 pre-existing failures unrelated to this fix (anovulatory-detection, phase-insights).
