---
date: 2026-04-16
agent: R4
area: claude-grounding
status: FIXED
severity: MEDIUM
verification_method: static-analysis
fixed_by: IMPL-W2B-13
fixed_date: 2026-04-17
---

# Analysis pipeline bypasses the Context Assembler

## One-sentence finding
`src/lib/ai/analyze.ts` calls Claude directly with raw system prompts from `src/lib/ai/prompts.ts`, skipping the three-layer Context Assembler and losing the static/dynamic boundary plus self-distrust injection.

## Expected
Every Claude API call in LanaeHealth must go through the Context Assembler (`src/lib/context/assembler.ts`) per CLAUDE.md:
> Every Claude API call goes through the Context Assembler

The assembler prepends `STATIC_SYSTEM_PROMPT` (with self-distrust, anti-anchoring, data honesty rules) and places the `__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__` marker before the dynamic context.

## Actual
`src/lib/ai/analyze.ts` lines 15-58 build system prompts directly from `SYSTEM_PROMPTS[analysisType]` in `src/lib/ai/prompts.ts`, with context shoved into the user message as `JSON.stringify(context, null, 2)`. No static/dynamic boundary marker, no self-distrust block, no assembler invocation.

```ts
// analyze.ts line 31-37
const response = await client.messages.create({
  model: ANALYSIS_MODEL,
  max_tokens: 4096,
  temperature: 0.3,
  system: systemPrompt,                             // raw prompt from prompts.ts
  messages: [{ role: 'user', content: truncatedMessage }],  // JSON stringified context
})
```

The prompts in `src/lib/ai/prompts.ts` (`diagnostic`, `biomarker`, `pathway`, `medication`, `flare`, `food`, `research`) are strong on format but include no "verify against data" or "memory is hints" language. They instruct Claude to respond ONLY with valid JSON, which blocks Claude from flagging when evidence is insufficient.

## Verification evidence
- `src/lib/ai/analyze.ts:31-37` shows direct messages.create call without assembler.
- `src/lib/ai/prompts.ts:1-192` shows 7 prompts, none include self-distrust or boundary marker.
- `grep -rn "getFullSystemPrompt\|assembleDynamicContext" src/lib/ai/analyze.ts` returns no matches.
- `grep -rn "getFullSystemPrompt\|assembleDynamicContext" src/lib/ai/` returns no matches.

## Recommended action
INVESTIGATE then FIX. Two paths depending on intent:

Option A (preferred): wire analyze.ts through the assembler.
```ts
import { getFullSystemPrompt } from '@/lib/context/assembler'
// ...
const { systemPrompt } = await getFullSystemPrompt(
  `Analysis type: ${analysisType}`,
  { includeAllSummaries: analysisType === 'diagnostic' },
)
const response = await client.messages.create({
  model: ANALYSIS_MODEL,
  max_tokens: 4096,
  temperature: 0.3,
  system: systemPrompt + '\n\n' + SYSTEM_PROMPTS[analysisType],
  messages: [{ role: 'user', content: truncatedMessage }],
})
```

Option B: if this pipeline is intentionally data-first (context already bundled in `prepareAnalysisContext`), keep it out of the assembler but inject the self-distrust prefix and the boundary marker into each of the 7 prompts in `src/lib/ai/prompts.ts`:
```
[SELF-DISTRUST PREFIX]
__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__
[existing prompt body]
```

Add a test that asserts the Claude call's system prompt contains `SELF-DISTRUST` or the boundary marker.

## Resolution (FIXED -- 2026-04-17, IMPL-W2B-13)

Option A applied. Changes:

1. `src/lib/ai/analyze.ts`
   - Imported `getFullSystemPrompt` from `@/lib/context/assembler`.
   - `runSingleAnalysis()` now calls the assembler first with a query of `Analysis type: <type>` and `{ includeAllSummaries: type === 'diagnostic' }`.
   - The assembler's returned `systemPrompt` (STATIC prompt + `__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__` + permanent core + topic-matched summaries + retrieval) is passed as the `system` param to `messages.create`.
   - The per-analysis instructions from `SYSTEM_PROMPTS[analysisType]` now prefix the user message, wrapped with a `<pipeline_evidence>` block around the JSON-stringified `AnalysisContext`.
   - `ANALYSIS_MODEL` unchanged (`claude-sonnet-4-6`), `max_tokens`, `temperature` unchanged.

2. `src/lib/ai/prompts.ts`
   - Untouched. The 7 prompts now function as user-message heads rather than system prompts; they still instruct the model to respond in the JSON schema unchanged.

3. `src/lib/__tests__/ai/analyze-through-assembler.test.ts` (NEW)
   - Mocks `@anthropic-ai/sdk`, `@/lib/context/assembler`, `@/lib/ai/cache`, `@/lib/ai/data-prep`, and `@/lib/supabase` so no live API call or DB read occurs.
   - Asserts: assembler called once per analysis type; the `system` param to `messages.create` equals the assembler's returned string (and contains `__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__`); the user message contains BOTH the analysis-prompt head and `<pipeline_evidence>`; diagnostic runs pass `includeAllSummaries: true`; a full 7-analysis pipeline invokes the assembler 7 times.
   - 5 tests, all green.

Full suite: 316 passed, 2 pre-existing failures (phase-insights editorial invariant, anovulatory-detection cycle count) unaffected by this change and out of lane.
