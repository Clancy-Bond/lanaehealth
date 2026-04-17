---
date: 2026-04-16
agent: R4
area: claude-grounding
status: FIXED
severity: HIGH
verification_method: static-analysis
---

# Wrong Claude model in analysis pipeline

## One-sentence finding
`src/lib/ai/analyze.ts` hardcodes `claude-sonnet-4-20250514`, violating the repo memory rule that mandates `claude-sonnet-4-6`.

## Expected
```ts
const ANALYSIS_MODEL = 'claude-sonnet-4-6'
```
Every other Claude call site in the repo uses `claude-sonnet-4-6` or `claude-3-5-haiku-20241022`. The memory rule explicitly says: "Model name: `claude-sonnet-4-6` (NOT claude-sonnet-4-6-20250514 per memory)".

## Actual
`src/lib/ai/analyze.ts:10`:
```ts
const ANALYSIS_MODEL = 'claude-sonnet-4-20250514'
```
This constant is used in `runSingleAnalysis()` at line 32, which is called for all 7 analysis types in parallel (`diagnostic`, `biomarker`, `pathway`, `medication`, `flare`, `food`, `research`).

## Verification evidence
```bash
$ grep -rn "claude-sonnet" src/
src/lib/import/parsers/pdf.ts:18:const MODEL = 'claude-sonnet-4-6'
src/lib/import/parsers/screenshot.ts:18:const MODEL = 'claude-sonnet-4-6'
src/lib/intelligence/persona-runner.ts:203:      model: 'claude-sonnet-4-6'
src/lib/context/handoff.ts:135:    model: 'claude-sonnet-4-6'
src/lib/ai/analyze.ts:10:const ANALYSIS_MODEL = 'claude-sonnet-4-20250514'  <-- outlier
src/lib/context/compaction.ts:220:    model: 'claude-sonnet-4-6'
src/app/api/labs/scan/route.ts:14:const MODEL = 'claude-sonnet-4-6'
src/app/api/narrative/weekly/route.ts:83:      model: 'claude-sonnet-4-6'
src/app/api/food/identify/route.ts:18:const MODEL = 'claude-sonnet-4-6'
src/app/api/chat/route.ts:20:const MODEL = 'claude-sonnet-4-6'
src/lib/context/summary-engine.ts:221:    model: 'claude-sonnet-4-6'
```

## Recommended action
FIX: one-line change at `src/lib/ai/analyze.ts:10`

```diff
-const ANALYSIS_MODEL = 'claude-sonnet-4-20250514'
+const ANALYSIS_MODEL = 'claude-sonnet-4-6'
```

Include a test: `expect(ANALYSIS_MODEL).toBe('claude-sonnet-4-6')` in a new unit test, or grep-for-model in CI.

## Verification (QA Session 2, IMPL-1, 2026-04-16)

Fix applied: `src/lib/ai/analyze.ts:10` now reads `const ANALYSIS_MODEL = 'claude-sonnet-4-6'`.

Regression test added: `src/lib/__tests__/model-constants.test.ts` recursively scans `src/` for any `claude-(sonnet|opus)-\d-202[5-9]\d{4}` dated snapshot and fails the suite if one is reintroduced. Haiku 4.5 snapshot `claude-haiku-4-5-20251001` is intentionally excluded per CLAUDE.md.

Grep after fix (no remaining offenders):
```
$ grep -rEn "claude-(sonnet|opus)-[0-9]-202[0-9]" src/
(no matches)
```

Vitest output:
```
Test Files  19 passed (19)
Tests  167 passed (167)
Duration  3.41s
```

166 pre-existing tests plus the new `model constants (regression guard)` case all green.
