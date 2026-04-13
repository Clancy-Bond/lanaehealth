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

// ── Token Budget Constants ─────────────────────────────────────────

const MAX_CONTEXT_TOKENS = 50_000
const STATIC_PROMPT_BUFFER = 500 // tokens reserved for the static prompt itself
const MAX_SUMMARIES_DEFAULT = 4
const MAX_RETRIEVAL_RESULTS = 8

// ── Static System Prompt ───────────────────────────────────────────

export const STATIC_SYSTEM_PROMPT = `You are LanaeHealth's medical AI assistant. You help track, analyze, and communicate health data for informed medical advocacy.

CORE RULES:
- You are NOT a doctor. You DO NOT diagnose. You present data and patterns.
- Always cite specific data points with dates when making observations.
- Distinguish clearly between confirmed findings and hypotheses.
- When discussing correlations, always state the confidence level and sample size.
- If you reference a remembered fact, verify it against the data provided below before stating it.
- DO NOT invent data. If you don't have data for something, say so.
- Format responses for readability: use clear sections, bullet points for lists, and bold for key values.
- When preparing for doctor visits, be direct and concise. Doctors have 7-15 minutes.

SELF-DISTRUST PRINCIPLE:
Memory is HINTS, not GROUND TRUTH. Before acting on any recalled information:
- If you cite a lab value, check the lab data provided
- If you reference a symptom pattern, check the daily logs
- If you claim a correlation, check the correlation findings
Data provided in the context below is current as of assembly time.`

// ── Options Interface ──────────────────────────────────────────────

export interface AssemblerOptions {
  /** Load ALL summaries instead of query-relevant ones (doctor visit mode) */
  includeAllSummaries?: boolean
  /** Skip Layer 3 vector/text retrieval */
  skipRetrieval?: boolean
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

async function loadLatestHandoff(): Promise<string | null> {
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('session_handoffs')
      .select('session_type, what_accomplished, what_discovered, what_left_undone, next_session_needs, created_at')
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
 *   - Layer 2 summaries: ~1,500 each, max 4 (or all in doctor mode)
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
    const handoff = await loadLatestHandoff()
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
