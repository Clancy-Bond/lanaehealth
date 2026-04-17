---
date: 2026-04-16
agent: R4
area: claude-grounding
status: FLAGGED
severity: MEDIUM
verification_method: static-analysis
---

# Claude API Grounding Audit (Static)

Inspection of every Claude prompt and response contract in LanaeHealth. No live API calls were made.

## Summary matrix

| # | File | Boundary preserved | Permanent core injected | Self-distrust | Topic-matched | No hallucination | Model correct | Prompt caching |
|---|---|---|---|---|---|---|---|---|
| 1 | src/lib/context/assembler.ts | PASS | PASS | PASS | PASS | PASS | n/a | MISSING |
| 2 | src/lib/context/permanent-core.ts | n/a (data) | PASS | n/a | n/a | PASS | n/a | n/a |
| 3 | src/lib/context/summary-engine.ts | PARTIAL | n/a | PASS | FLAGGED | PASS | PASS | MISSING |
| 4 | src/lib/context/compaction.ts | PASS | n/a | n/a | n/a | PASS | PASS | MISSING |
| 5 | src/lib/context/handoff.ts | PASS | n/a | n/a | n/a | PASS | PASS | MISSING |
| 6 | src/lib/context/vector-store.ts | n/a (retrieval) | n/a | n/a | PASS | n/a | n/a (OpenAI) | n/a |
| 7 | src/lib/intelligence/personas/clinical-analyst.ts | PASS | n/a (uses own context) | PASS | n/a | PASS | PASS (via runner) | MISSING |
| 8 | src/lib/intelligence/personas/hypothesis-doctor.ts | PASS | n/a | PASS | n/a | PASS | PASS | MISSING |
| 9 | src/lib/intelligence/personas/challenger.ts | PASS | n/a | PASS | n/a | PASS | PASS | MISSING |
| 10 | src/lib/intelligence/personas/research-librarian.ts | PASS | n/a | PASS | n/a | PASS | PASS | MISSING |
| 11 | src/lib/intelligence/personas/next-best-action.ts | PASS | n/a | PASS | n/a | PASS | PASS | MISSING |
| 12 | src/lib/intelligence/personas/synthesizer.ts | PASS | n/a | PASS | n/a | PASS | PASS | MISSING |
| 13 | src/app/api/chat/route.ts | PASS (via assembler) | PASS | PASS | PASS | PASS | PASS | MISSING |
| 14 | src/app/api/reports/doctor/route.ts | n/a (JSON only, no Claude call) | n/a | n/a | n/a | n/a | n/a | n/a |
| 15 | src/app/api/analyze/correlations/route.ts | n/a (stat pipeline, no direct Claude call) | n/a | n/a | n/a | n/a | n/a | n/a |
| 16 | src/app/api/intelligence/analyze/route.ts | n/a (orchestrator only) | n/a | n/a | n/a | n/a | n/a | n/a |
| 17 | src/app/api/narrative/weekly/route.ts | PASS | PASS | PASS | n/a | PASS | PASS | MISSING |
| 18 | src/lib/ai/analyze.ts | FAIL (no assembler; bare prompts) | FAIL | FAIL | n/a | PARTIAL | **FAIL** | MISSING |
| 19 | src/app/api/labs/scan/route.ts | n/a (stateless OCR) | n/a | n/a | n/a | PASS | PASS | n/a |
| 20 | src/app/api/food/identify/route.ts | n/a (stateless vision) | n/a | n/a | n/a | PASS | PASS | n/a |
| 21 | src/lib/import/normalizer.ts | n/a (stateless) | n/a | n/a | n/a | PASS | PASS (haiku) | n/a |
| 22 | src/lib/import/parsers/*.ts (5 files) | n/a (stateless) | n/a | n/a | n/a | PASS | PASS | n/a |

## PASS observations

- **Assembler at src/lib/context/assembler.ts** is the canonical static/dynamic boundary implementation. Line 292-296 literally writes:
  ```
  ${STATIC_SYSTEM_PROMPT}
  __SYSTEM_PROMPT_DYNAMIC_BOUNDARY__
  ${context}
  ```
  Static prompt at line 32-66 contains OBJECTIVITY RULES, ANTI-ANCHORING, RESEARCH AWARENESS, DATA HONESTY, and an explicit SELF-DISTRUST PRINCIPLE block (line 57-62): "Memory is HINTS, not GROUND TRUTH. Before acting on any recalled information: If you cite a lab value, check the lab data..."
- **Permanent core injection** confirmed in assembler.ts line 153-166 (Layer 1, ALWAYS). Dynamically generated from live DB queries in src/lib/context/permanent-core.ts lines 74-219. Never falls back to memory.
- **Topic detection** in src/lib/context/summary-engine.ts line 317-338 is keyword-matched against SUMMARY_TOPICS, not random. Always includes `last_90_days` as baseline.
- **Weekly narrative route** at src/app/api/narrative/weekly/route.ts line 76-79 correctly uses `${STATIC_SYSTEM_PROMPT}\n__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__\n${context}` and explicit comment "Static/Dynamic boundary: stable instructions first, dynamic context last".
- **Compaction** at src/lib/context/compaction.ts line 86-95 enforces a 9-section template and explicitly forbids paraphrasing user messages in Section 6 (verbatim copy rule). The system prompt lists "CRITICAL RULES: NEVER drop exact lab values, NEVER drop dates, NEVER paraphrase user messages in Section 6".
- **Handoff** at src/lib/context/handoff.ts line 24-40 uses an explicit 4-section template (ACCOMPLISHED, DISCOVERED, LEFT UNDONE, NEXT SESSION NEEDS). Not free-form.
- **Personas** use structured output markers (FINDINGS / DATA_QUALITY / DELTA / HANDOFF) and each persona's system prompt is stable and cache-friendly. Dynamic context is always appended via `userContent` in the user message (persona-runner.ts line 192-199), preserving boundary.
- **No hallucination-inviting language** in any audited prompt. Summary-engine.ts line 202 explicitly states "You never invent or hallucinate data points. You use exact numbers and dates from the source data." and line 210 adds "DO NOT invent data not present in the raw data."

## FAIL findings

### Finding F1 (HIGH severity)
**File:** `src/lib/ai/analyze.ts` line 10
```
const ANALYSIS_MODEL = 'claude-sonnet-4-20250514'
```
Violates the documented memory rule "Model name: `claude-sonnet-4-6` (NOT claude-sonnet-4-6-20250514 per memory)". This is an old Sonnet 4 dated snapshot. Every call in `runSingleAnalysis()` routes through this constant. See finding doc: `docs/qa/2026-04-16-analyze-ts-wrong-model.md`.

### Finding F2 (MEDIUM severity)
**File:** `src/lib/ai/analyze.ts` lines 15-58
The 7 analysis types (`diagnostic`, `biomarker`, `pathway`, `medication`, `flare`, `food`, `research`) are called WITHOUT the Context Assembler. They bypass Layer 1 (permanent core), Layer 2 (topic-matched summaries), and Layer 3 (retrieval). The system prompt comes from `SYSTEM_PROMPTS[analysisType]` and the user message is `JSON.stringify(context, null, 2)` from `prepareAnalysisContext()`. There is no `__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__` marker, no self-distrust principle injection, and no verification-against-data directive. See finding doc: `docs/qa/2026-04-16-analyze-pipeline-bypasses-assembler.md`.

### Finding F3 (MEDIUM severity, pre-existing, flagged in final-report.md #4)
**File:** `src/lib/context/summary-prompts.ts`
The query "dizziness" matches no topics. Keywords across SUMMARY_TOPICS include "presyncope", "syncope", "faint", "blackout", "vision", "orthostatic", "pots" but not "dizzy" or "dizziness". Confirmed in `/api/context/test` result `dizziness_has_neuro: false`, `dizziness_has_cv: false`. See finding doc: `docs/qa/2026-04-16-dizziness-topic-mapping.md`.

### Finding F4 (LOW-MEDIUM severity)
**Files:** all 13 Claude call sites
No prompt caching is configured anywhere. No `cache_control` markers, no `anthropic-beta: prompt-caching-2024-07-31` header. The static/dynamic split is correctly ordered but the cache benefit is unrealized. For the chat route in particular, where `STATIC_SYSTEM_PROMPT` is ~700 tokens and invariant across calls, a `cache_control: {type: 'ephemeral'}` marker on the static portion would cut cost materially after the first call in a 5-minute window. See finding doc: `docs/qa/2026-04-16-prompt-caching-not-configured.md`.

### Finding F5 (LOW severity)
**File:** `src/lib/intelligence/persona-runner.ts` line 192-199
Persona handoffs are appended to the user message with plaintext `--- HANDOFF FROM ... ---` markers. This works, but means the handoff content is NOT inside the cacheable static block. Not a boundary violation (handoffs are dynamic), but the persona system prompts themselves could be cached as static prefixes. Related to F4.

## Compaction and hallucination-vector checklist

- Chat compaction: uses 9-section template. PASS.
- Handoff writer: uses 4-section template, not free-form. PASS.
- Summary-engine generation: explicit "do not invent" clause. PASS.
- Personas: structured markers + explicit "quote exact values and dates". PASS.
- Lab OCR / food vision / importer parsers: stateless extractions with explicit "extract EVERY test" or schema-bound JSON output. PASS (no hallucination invitation).

## Recommended actions

1. Fix F1: change `src/lib/ai/analyze.ts:10` from `'claude-sonnet-4-20250514'` to `'claude-sonnet-4-6'`.
2. Fix F2: route `runFullAnalysis()` through the Context Assembler, or document why it is intentionally bypassing it and add the self-distrust principle to each prompt in `src/lib/ai/prompts.ts`.
3. Fix F3: add "dizziness", "dizzy", "lightheaded", "lightheadedness" keywords to `cv_orthostatic` and `neuro_presyncope` in `src/lib/context/summary-prompts.ts`.
4. Fix F4: add `cache_control: {type: 'ephemeral'}` to the static portion of system prompts at chat-route, narrative/weekly, and each persona. Requires bumping SDK to a version that supports prompt caching or adding `extra_headers`.
5. Consider F5 as follow-on after F4 lands.
