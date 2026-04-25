/**
 * Context Assembler - The Central Orchestrator
 *
 * Every Claude API call in LanaeHealth goes through this module.
 * It combines the three memory layers into a single system prompt:
 *
 *   1. STATIC_SYSTEM_PROMPT  - identity, rules, tools (cached by Claude)
 *   2. __SYSTEM_PROMPT_DYNAMIC_BOUNDARY__
 *   3. Dynamic context       - patient data, summaries, retrieval results
 *
 * Design principles:
 *   - Static/Dynamic boundary: stable content first (cached), volatile last
 *   - Self-distrust: memory is hints, not ground truth
 *   - Token budget: keep total under 50,000 tokens
 */

import { generatePermanentCore } from './permanent-core'
import { getSummary, detectRelevantTopics } from './summary-engine'
import { searchByText } from './vector-store'
import { SUMMARY_TOPICS, type SummaryTopic } from './summary-prompts'
import { createServiceClient } from '@/lib/supabase'
import { getPrivacyPrefs } from '@/lib/api/privacy-prefs'
import { PROMPT_INJECTION_DIRECTIVE } from '@/lib/ai/safety/wrap-user-content'

// ── Token Budget Constants ─────────────────────────────────────────

const MAX_CONTEXT_TOKENS = 50_000
const STATIC_PROMPT_BUFFER = 500 // tokens reserved for the static prompt itself
const MAX_SUMMARIES_DEFAULT = 6
const MAX_RETRIEVAL_RESULTS = 8

// ── Static System Prompt ───────────────────────────────────────────

export const STATIC_SYSTEM_PROMPT = `You are LanaeHealth's clinical reasoning assistant. You help identify patterns, track hypotheses, and prepare for medical advocacy.

OBJECTIVITY RULES:
- Present ALL active hypotheses with their current confidence categories.
- NEVER state a single diagnosis as likely without presenting alternatives.
- When new data arrives, explicitly state what it does to each hypothesis.
- Cite specific data points with dates for every claim.
- Distinguish: ESTABLISHED (confirmed) vs PROBABLE vs POSSIBLE vs SPECULATIVE vs INSUFFICIENT DATA.
- Flag when confidence rests on low-reliability data sources (e.g., food diary vs lab results).

ANTI-ANCHORING:
- If a hypothesis has been stable for >30 days without new evidence, state: "This hypothesis hasn't been challenged recently."
- Always present the Challenger's view alongside the main hypothesis.
- Search for the unifying diagnosis that explains the most symptoms across body systems.

RESEARCH AWARENESS:
- Cite relevant medical literature with evidence grades when available.
- Flag when studies have low sample sizes or weak methodology.
- Note when clinical guidelines recommend specific actions for this patient's data.

DATA HONESTY:
- State data completeness limitations that affect the analysis.
- Note when findings come from low-reliability sources (e.g., food diary at 50% coverage).
- Do not present wearable data (Oura) with the same certainty as lab results.

SELF-DISTRUST PRINCIPLE:
Memory is HINTS, not GROUND TRUTH. Before acting on any recalled information:
- If you cite a lab value, check the lab data or Knowledge Base provided.
- If you reference a symptom pattern, verify against the data.
- If you claim a correlation, check the correlation findings.

FORMAT:
- Use clear sections, bullet points for lists, bold for key values.
- When preparing for doctor visits, be direct and concise. Doctors have 7-15 minutes.
- When discussing hypotheses, always show the confidence category and key evidence.

${PROMPT_INJECTION_DIRECTIVE}`

// ── Options Interface ──────────────────────────────────────────────

export interface AssemblerOptions {
  /** Load ALL summaries instead of query-relevant ones (doctor visit mode) */
  includeAllSummaries?: boolean
  /** Skip Layer 3 vector/text retrieval */
  skipRetrieval?: boolean
  /** Skip Knowledge Base loading (use old Layer 2 summaries only) */
  skipKnowledgeBase?: boolean
  /**
   * Authenticated user whose data should be loaded into context.
   *
   * Multi-user productization (PR #81 follow-up): the assembler must
   * scope every Layer-1/2/3 read to a specific user, not the legacy
   * single-tenant ('lanae') row. Callers (chat, doctor, reports
   * routes) pass req-scoped user.id from their auth context.
   *
   * Optional today: when omitted, the assembler falls back to env
   * OWNER_USER_ID so legacy single-tenant tooling keeps working
   * during the rollout. Once every caller threads userId, this
   * fallback can be removed.
   */
  userId?: string
}

// ── Section Tracking ───────────────────────────────────────────────

export interface AssembledSections {
  permanentCore: string | null
  handoff: string | null
  summaries: Array<{ topic: string; content: string }>
  retrieval: string | null
}

// ── Token Estimation ───────────────────────────────────────────────

function estimateTokens(text: string): number {
  return Math.round(text.length / 4)
}

// ── Session Handoff Loader ─────────────────────────────────────────

async function loadLatestHandoff(userId?: string): Promise<string | null> {
  try {
    const sb = createServiceClient()
    const base = sb
      .from('session_handoffs')
      .select('session_type, what_accomplished, what_discovered, what_left_undone, next_session_needs, created_at')
    const filtered = userId ? base.eq('user_id', userId) : base
    const { data, error } = await filtered
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) return null

    const lines: string[] = []
    lines.push(`Session type: ${data.session_type}`)
    lines.push(`Date: ${data.created_at}`)
    lines.push(`What was accomplished: ${data.what_accomplished}`)
    lines.push(`What was discovered: ${data.what_discovered}`)
    if (data.what_left_undone) {
      lines.push(`What was left undone: ${data.what_left_undone}`)
    }
    if (data.next_session_needs) {
      lines.push(`Next session needs: ${data.next_session_needs}`)
    }

    return lines.join('\n')
  } catch {
    // Handoff is optional - don't fail the whole assembly
    return null
  }
}

// ── Dynamic Context Assembly ───────────────────────────────────────

/**
 * Assembles the dynamic context from all three memory layers.
 *
 * Token budget tracking:
 *   - Layer 1 permanent core: ~800 tokens
 *   - Session handoff: ~500 tokens
 *   - Layer 2 micro-summaries: ~800 each, max 6 (or all in doctor mode)
 *   - Layer 3 retrieval: ~200 each, max 8
 *
 * Stops adding content when approaching MAX_CONTEXT_TOKENS.
 */
export async function assembleDynamicContext(
  userQuery: string,
  options: AssemblerOptions = {},
): Promise<{ context: string; sections: AssembledSections; tokenEstimate: number }> {
  let totalTokens = estimateTokens(STATIC_SYSTEM_PROMPT) + STATIC_PROMPT_BUFFER
  const parts: string[] = []
  const sections: AssembledSections = {
    permanentCore: null,
    handoff: null,
    summaries: [],
    retrieval: null,
  }

  // ── Privacy Gate (Wave 2e F10) ───────────────────────────────
  //
  // If the user has opted out of Claude-side context injection via
  // /settings/privacy, short-circuit here. The static system prompt
  // is still sent (identity, rules) but ZERO patient data is added.
  // This is the HARD enforcement point for allow_claude_context.
  try {
    const prefs = await getPrivacyPrefs()
    if (prefs.allow_claude_context === false) {
      parts.push(
        '<privacy_notice>\n'
        + 'The patient has disabled AI context injection. No personal health data is available for this turn. Ask the user to share the specific detail you need, or suggest they re-enable context injection in Settings -> Privacy.\n'
        + '</privacy_notice>',
      )
      const context = parts.join('\n\n')
      totalTokens += estimateTokens(context)
      return { context, sections, tokenEstimate: totalTokens }
    }
  } catch (err) {
    // A read failure on privacy_prefs must NEVER bypass the gate.
    // We already fail open in getPrivacyPrefs (returns defaults) so
    // this catch is defensive; if some unexpected sync-throw leaks
    // through we err on the side of redacting, not exposing.
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Assembler: privacy gate check failed; redacting context:', msg)
    parts.push(
      '<privacy_notice>\n'
      + 'Privacy preferences could not be verified. Context injection is suppressed until the check succeeds.\n'
      + '</privacy_notice>',
    )
    const context = parts.join('\n\n')
    totalTokens += estimateTokens(context)
    return { context, sections, tokenEstimate: totalTokens }
  }

  // ── Layer 1: Permanent Core (ALWAYS) ─────────────────────────
  try {
    const core = await generatePermanentCore()
    const coreTokens = estimateTokens(core)

    if (totalTokens + coreTokens < MAX_CONTEXT_TOKENS) {
      parts.push(`<patient_context>\n${core}\n</patient_context>`)
      sections.permanentCore = core
      totalTokens += coreTokens
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Assembler: Failed to load permanent core:', msg)
  }

  // ── Session Handoff ──────────────────────────────────────────
  try {
    const userId = options.userId ?? process.env.OWNER_USER_ID
    const handoff = await loadLatestHandoff(userId)
    if (handoff) {
      const handoffTokens = estimateTokens(handoff)
      if (totalTokens + handoffTokens < MAX_CONTEXT_TOKENS) {
        parts.push(`<last_session_handoff>\n${handoff}\n</last_session_handoff>`)
        sections.handoff = handoff
        totalTokens += handoffTokens
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Assembler: Failed to load session handoff:', msg)
  }

  // ── Knowledge Base (Clinical Intelligence Engine) ──────────────
  if (!options.skipKnowledgeBase) {
    try {
      const { loadRelevantKBContext } = await import('@/lib/intelligence/knowledge-base')
      const kbBudget = Math.min(15_000, MAX_CONTEXT_TOKENS - totalTokens - 5_000) // reserve 5K for summaries + retrieval
      if (kbBudget > 0) {
        const kb = await loadRelevantKBContext(userQuery, kbBudget)
        if (kb.text.length > 0) {
          parts.push(`<clinical_knowledge_base>\n${kb.text}\n</clinical_knowledge_base>`)
          totalTokens += kb.tokenCount
          console.log(`Assembler: Loaded ${kb.documentsLoaded.length} KB documents (${kb.tokenCount} tokens)`)
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('Assembler: Failed to load KB context:', msg)
      // KB is optional - fall through to summaries
    }
  }

  // ── Layer 2: Summaries ───────────────────────────────────────
  try {
    let topicsToLoad: SummaryTopic[]

    if (options.includeAllSummaries) {
      // Doctor mode: load all summaries
      topicsToLoad = Object.keys(SUMMARY_TOPICS) as SummaryTopic[]
    } else {
      // Normal mode: detect relevant topics from query (max 4)
      topicsToLoad = detectRelevantTopics(userQuery).slice(0, MAX_SUMMARIES_DEFAULT)
    }

    for (const topic of topicsToLoad) {
      if (totalTokens >= MAX_CONTEXT_TOKENS) break

      try {
        const summaryContent = await getSummary(topic)
        const summaryTokens = estimateTokens(summaryContent)

        if (totalTokens + summaryTokens < MAX_CONTEXT_TOKENS) {
          const topicName = SUMMARY_TOPICS[topic].name
          parts.push(`<summary topic="${topicName}">\n${summaryContent}\n</summary>`)
          sections.summaries.push({ topic, content: summaryContent })
          totalTokens += summaryTokens
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`Assembler: Failed to load summary for ${topic}:`, msg)
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Assembler: Failed during summary loading:', msg)
  }

  // ── Layer 3: Retrieval (unless skipped) ──────────────────────
  if (!options.skipRetrieval && totalTokens < MAX_CONTEXT_TOKENS) {
    try {
      const results = await searchByText(userQuery, {
        matchCount: MAX_RETRIEVAL_RESULTS,
      })

      if (results.length > 0) {
        const retrievalParts: string[] = []

        for (const result of results) {
          const entryText = `[${result.contentDate}] (${result.contentType}${result.cyclePhase ? ', ' + result.cyclePhase : ''}${result.painLevel !== null ? ', pain ' + result.painLevel + '/10' : ''}) ${result.narrative}`
          const entryTokens = estimateTokens(entryText)

          if (totalTokens + entryTokens >= MAX_CONTEXT_TOKENS) break

          retrievalParts.push(entryText)
          totalTokens += entryTokens
        }

        if (retrievalParts.length > 0) {
          const retrievalBlock = retrievalParts.join('\n\n')
          parts.push(`<retrieved_records>\n${retrievalBlock}\n</retrieved_records>`)
          sections.retrieval = retrievalBlock
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('Assembler: Failed during retrieval:', msg)
    }
  }

  const context = parts.join('\n\n')

  return {
    context,
    sections,
    tokenEstimate: totalTokens,
  }
}

// ── Full System Prompt ─────────────────────────────────────────────

/**
 * Combines the static prompt + boundary marker + dynamic context.
 * This is what gets passed as the `system` parameter to Claude API calls.
 */
export async function getFullSystemPrompt(
  userQuery: string,
  options: AssemblerOptions = {},
): Promise<{ systemPrompt: string; tokenEstimate: number; charCount: number; sections: AssembledSections }> {
  const { context, sections, tokenEstimate } = await assembleDynamicContext(userQuery, options)

  const systemPrompt = `${STATIC_SYSTEM_PROMPT}

__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__

${context}`

  return {
    systemPrompt,
    tokenEstimate,
    charCount: systemPrompt.length,
    sections,
  }
}

// ── Cached System Prompt (Anthropic prompt caching) ────────────────

/**
 * Anthropic system-prompt content block. Matches the shape expected by
 * `@anthropic-ai/sdk`'s `messages.create({ system: [...] })` when passing
 * an array instead of a single string.
 *
 * We avoid importing Anthropic.TextBlockParam here so this module stays
 * SDK-free for the test surface; the shape is structurally compatible.
 */
export interface CachedSystemBlock {
  type: 'text'
  text: string
  cache_control?: { type: 'ephemeral' }
}

/**
 * Returns the system prompt as a two-block array suitable for Anthropic
 * prompt caching. The first block is the STATIC prefix (identity, rules,
 * self-distrust) and carries `cache_control: { type: 'ephemeral' }`. The
 * second block is the DYNAMIC context (permanent core, handoff, summaries,
 * retrieval) and carries no cache_control so it recomputes each call.
 *
 * After the first call warms the cache, subsequent calls within the 5-min
 * TTL read the static prefix at 10 percent of the normal input price.
 *
 * Shape match the SDK's expected system-param array:
 *   system: [
 *     { type: 'text', text: STATIC_PART, cache_control: { type: 'ephemeral' } },
 *     { type: 'text', text: DYNAMIC_PART },
 *   ]
 */
export async function getFullSystemPromptCached(
  userQuery: string,
  options: AssemblerOptions = {},
): Promise<{
  system: CachedSystemBlock[]
  tokenEstimate: number
  charCount: number
  sections: AssembledSections
}> {
  const { context, sections, tokenEstimate } = await assembleDynamicContext(userQuery, options)

  const dynamicText = `__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__\n\n${context}`

  const system: CachedSystemBlock[] = [
    {
      type: 'text',
      text: STATIC_SYSTEM_PROMPT,
      cache_control: { type: 'ephemeral' },
    },
    {
      type: 'text',
      text: dynamicText,
    },
  ]

  return {
    system,
    tokenEstimate,
    charCount: STATIC_SYSTEM_PROMPT.length + dynamicText.length,
    sections,
  }
}

/**
 * Split a pre-assembled single-string system prompt on the boundary
 * marker into a cached two-block array. Used by call sites that already
 * hand-assembled the string (narrative/weekly, insight-narrator) and want
 * to opt into caching without re-routing through the assembler.
 *
 * If the marker is missing, the whole string is treated as static and
 * cached (safe fallback -- worst case the cache is recomputed when the
 * string changes).
 */
export function splitSystemPromptForCaching(systemPrompt: string): CachedSystemBlock[] {
  const marker = '__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__'
  const idx = systemPrompt.indexOf(marker)

  if (idx === -1) {
    return [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ]
  }

  const staticPart = systemPrompt.slice(0, idx).replace(/\s+$/, '')
  const dynamicPart = systemPrompt.slice(idx)

  return [
    {
      type: 'text',
      text: staticPart,
      cache_control: { type: 'ephemeral' },
    },
    {
      type: 'text',
      text: dynamicPart,
    },
  ]
}
