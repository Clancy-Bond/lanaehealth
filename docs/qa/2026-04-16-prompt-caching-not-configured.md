---
date: 2026-04-16
agent: R4
area: claude-grounding
status: FIXED
severity: LOW
verification_method: static-analysis
fixed_by: IMPL-W3-5 (2026-04-17)
---

# Prompt caching is not configured anywhere

## FIX STATUS (2026-04-17, IMPL-W3-5)

Wired Anthropic prompt-caching breakpoints into every LanaeHealth call site
that routes through the Context Assembler or hand-builds the
`__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__` prefix.

Changes:
- `src/lib/context/assembler.ts`: added `getFullSystemPromptCached()` which
  returns `system` as a two-block array (static prefix with
  `cache_control: { type: 'ephemeral' }`, dynamic context without), and
  `splitSystemPromptForCaching()` which splits a pre-assembled string on
  the boundary marker for call sites that still hand-build.
- `src/lib/ai/cache-metrics.ts`: new shared `logCacheMetrics(response,
  label)` helper that prints a bracket-tagged line containing
  `cache_read_input_tokens` / `cache_creation_input_tokens` whenever the
  SDK returns them.
- `src/app/api/chat/route.ts`: chat loop now passes the cached array.
  Each iteration logs `[cache_metrics label=chat:iter<N> ...]`. This is
  the biggest saver -- the ~700-token static prefix is served at 10%
  cost for every iteration after the first in the 5-minute TTL, and the
  chat route runs up to 20 iterations per request.
- `src/lib/ai/analyze.ts`: routes via the cached variant. For a 7-type
  full run, iterations 2-7 read the static prefix from cache.
- `src/app/api/narrative/weekly/route.ts`: uses
  `splitSystemPromptForCaching()` on its hand-built prompt.
- `src/lib/intelligence/insight-narrator.ts`: same pattern, splits the
  narrator-rules prompt at the boundary.

New regression test: `src/lib/__tests__/ai/prompt-caching.test.ts` --
mocks the SDK and asserts (1) `system` is an array, (2) first block has
`cache_control.type === 'ephemeral'`, (3) second block has NO
`cache_control`, (4) `logCacheMetrics` emits the expected line. Updated
`analyze-through-assembler.test.ts` to assert the array shape too.

Expected cost savings: STATIC prefix is ~700-2000 tokens (identity,
anti-anchoring, self-distrust, narrator rules, knowledge-base header).
With a 1-minute back-and-forth chat session that issues 8 Claude
iterations and reuses the same static prefix: previously 8 * $(full
input price) -> now 1 * full + 7 * 10% = ~22% of the un-cached input
cost on the static portion. Sonnet 4.6 input is $3 per 1M tokens, so a
typical user session saves roughly $0.02-0.05 per session; scaled to
the analyze pipeline's 7-call fan-out, savings are similar per run.

---

# Prompt caching is not configured anywhere (original finding below)

## One-sentence finding
The codebase structures static content first and dynamic content last (boundary is correct), but no call site adds Anthropic prompt-caching markers, so the cost savings from the boundary pattern are never realized.

## Expected
Per the Anthropic SDK, caching is opt-in: you set `cache_control: {type: 'ephemeral'}` on content blocks in the `system` parameter (or tools / messages). With cache hits, the cached prefix is 10% of the normal input cost within a 5-minute TTL. LanaeHealth's chat route is a textbook use case: STATIC_SYSTEM_PROMPT is ~700 tokens and invariant across calls.

## Actual
Grepping the repo:
```bash
$ grep -rn "cache_control\|cacheControl\|prompt_caching\|anthropic-beta" src/
(no matches)
```

Every call site uses the simpler string form of `system:`, e.g. `src/app/api/chat/route.ts:82`:
```ts
const response = await client.messages.create({
  model: MODEL,
  max_tokens: 4096,
  system: systemPrompt,   // plain string, no cache breakpoint
  tools: CHAT_TOOLS as Anthropic.Tool[],
  messages,
})
```

## Verification evidence
- All 13 Claude call sites inspected (see `research/claude-grounding.md` matrix).
- None pass `system` as an array of blocks with `cache_control`.
- No `extra_headers` with `anthropic-beta`.

## Recommended action
FIX (optional but high-ROI). Convert `system` into a two-block array with cache control on the static prefix:

```ts
const [staticPart, dynamicPart] = systemPrompt.split('__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__')

const response = await client.messages.create({
  model: MODEL,
  max_tokens: 4096,
  system: [
    {
      type: 'text',
      text: staticPart,
      cache_control: { type: 'ephemeral' },
    },
    {
      type: 'text',
      text: dynamicPart,
    },
  ],
  tools: CHAT_TOOLS as Anthropic.Tool[],
  messages,
})
```

Do this in this priority order:
1. `src/app/api/chat/route.ts` (hot path, chat loop up to 20 iterations).
2. `src/app/api/narrative/weekly/route.ts` (regeneration calls).
3. Persona runner at `src/lib/intelligence/persona-runner.ts:201-207`. The persona system prompts are stable strings; cache them.
4. `src/lib/context/summary-engine.ts`, `compaction.ts`, `handoff.ts` (lower volume).

Verify via the API response's `usage.cache_read_input_tokens` and `usage.cache_creation_input_tokens` fields (log them in a per-request trace). Reject the change if cache_read is zero after warm-up.
