/**
 * Nutrition Coach Chat API Route
 *
 * POST /api/chat/nutrition-coach
 * Body: { message: string }
 *
 * Grounds Claude in Lanae's food_entries + cycle context so the response
 * is her data, not generic nutrition advice. Route structure:
 *
 *   1. Assemble the three-layer context via assembler.ts (permanent core,
 *      summaries, retrieval) with cached static prefix.
 *   2. Append the nutrition-coach persona static prompt and the dynamic
 *      coach-specific context block AFTER the assembler boundary.
 *   3. Load prior nutrition-coach messages (subject='nutrition_coach') so
 *      the conversation has memory.
 *   4. Call Claude with prompt caching on.
 *   5. Persist the user + assistant messages to chat_messages tagged with
 *      subject='nutrition_coach'. If the `subject` column does not exist
 *      in the shared Supabase (silent rollout), the insert retries without
 *      it and logs a warning; the response to the user is unaffected.
 *
 * Voice rules are enforced inside the persona static prompt. This file
 * never adds guidance text of its own (avoids polluting the cached
 * static prefix with drift).
 */

import Anthropic from '@anthropic-ai/sdk'
import { getFullSystemPromptCached, type CachedSystemBlock } from '@/lib/context/assembler'
import { logCacheMetrics } from '@/lib/ai/cache-metrics'
import { createServiceClient } from '@/lib/supabase'
import {
  NUTRITION_COACH_PERSONA,
  NUTRITION_COACH_SUBJECT,
  looksNutritionRelevant,
} from '@/lib/personas/nutrition-coach'
import { buildNutritionCoachContext } from '@/lib/intelligence/nutrition-coach-context'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_HISTORY_MESSAGES = 20

interface StoredChatMessage {
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Load prior nutrition-coach messages. Falls back to an empty history
 * if the `subject` column does not exist in the shared schema. That
 * situation is acceptable rollout behavior; each call is still grounded
 * in the three-layer context and the patient's 5,781-meal history via
 * the dynamic context builder.
 */
async function loadCoachHistory(): Promise<StoredChatMessage[]> {
  const supabase = createServiceClient()
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('role, content, created_at')
      .eq('subject', NUTRITION_COACH_SUBJECT)
      .order('created_at', { ascending: true })
      .limit(MAX_HISTORY_MESSAGES)

    if (error) {
      if (/column.*subject.*does not exist/i.test(error.message)) {
        console.warn('[nutrition-coach] chat_messages.subject column missing; starting conversation cold.')
        return []
      }
      console.warn('[nutrition-coach] history load failed:', error.message)
      return []
    }
    return (data || []) as StoredChatMessage[]
  } catch (err) {
    console.warn(
      '[nutrition-coach] history load threw:',
      err instanceof Error ? err.message : String(err),
    )
    return []
  }
}

/**
 * Persist a user + assistant message pair. Tries to write with a
 * `subject` column first; if the column does not exist, retries without
 * it so the insert does not fail on older schemas.
 */
async function persistCoachMessages(
  userMessage: string,
  assistantMessage: string,
): Promise<void> {
  const supabase = createServiceClient()
  const now = new Date().toISOString()

  const rowsWithSubject = [
    {
      role: 'user' as const,
      content: userMessage,
      tools_used: null,
      created_at: now,
      subject: NUTRITION_COACH_SUBJECT,
    },
    {
      role: 'assistant' as const,
      content: assistantMessage,
      tools_used: null,
      created_at: new Date(Date.now() + 1).toISOString(),
      subject: NUTRITION_COACH_SUBJECT,
    },
  ]

  const firstAttempt = await supabase.from('chat_messages').insert(rowsWithSubject)
  if (!firstAttempt.error) return

  if (/column.*subject.*of relation.*chat_messages.*does not exist/i.test(firstAttempt.error.message)) {
    console.warn('[nutrition-coach] subject column missing; persisting without tag.')
    // Retry without subject; the rows will live in the general stream but
    // will not leak into the main /chat UI because that UI reads via the
    // existing /api/chat/history route which is not affected here.
    const rowsNoSubject = rowsWithSubject.map(({ subject: _subject, ...rest }) => rest)
    const retry = await supabase.from('chat_messages').insert(rowsNoSubject)
    if (retry.error) {
      console.warn('[nutrition-coach] persist retry failed:', retry.error.message)
    }
    return
  }

  console.warn('[nutrition-coach] persist failed:', firstAttempt.error.message)
}

/**
 * Compose the system-block array passed to Anthropic. The base assembler
 * returns a two-block array (static prefix cached, dynamic context
 * fresh). We append a third block that carries the nutrition-coach
 * static persona (cached too, it never changes) and a fourth block
 * carrying the coach-specific dynamic data. Putting the persona text
 * in its OWN cached block means the base assembler's static prefix
 * cache key is unchanged.
 */
async function buildSystemBlocks(userMessage: string): Promise<{
  blocks: CachedSystemBlock[]
  tokenEstimate: number
  coachContextSections: Awaited<ReturnType<typeof buildNutritionCoachContext>>['sections']
}> {
  const { system, tokenEstimate } = await getFullSystemPromptCached(userMessage)
  const coachContext = await buildNutritionCoachContext()

  const blocks: CachedSystemBlock[] = [
    ...system,
    {
      type: 'text',
      text: NUTRITION_COACH_PERSONA.staticPrompt,
      cache_control: { type: 'ephemeral' },
    },
    {
      type: 'text',
      text: coachContext.text,
    },
  ]

  return { blocks, tokenEstimate, coachContextSections: coachContext.sections }
}

// ── POST handler ───────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { message?: string }

    if (!body.message || typeof body.message !== 'string') {
      return Response.json(
        { error: 'Missing required field: message (string)' },
        { status: 400 },
      )
    }

    const userMessage = body.message.trim()
    if (userMessage.length === 0) {
      return Response.json({ error: 'Message cannot be empty' }, { status: 400 })
    }

    // Soft scope hint. We do NOT hard-block off-topic questions; the
    // persona prompt already redirects them. But we flag for logging
    // so drift can be audited later.
    const onTopic = looksNutritionRelevant(userMessage)
    if (!onTopic) {
      console.log('[nutrition-coach] scope warning: keyword match failed for message; model will redirect if needed.')
    }

    // ---- 1. Assemble system blocks through the three-layer pipeline ----
    const { blocks, coachContextSections } = await buildSystemBlocks(userMessage)

    // ---- 2. Load coach-subject conversation history ----
    const history = await loadCoachHistory()

    const conversation: Anthropic.MessageParam[] = history.map((row) => ({
      role: row.role,
      content: row.content,
    }))
    conversation.push({ role: 'user', content: userMessage })

    // ---- 3. Call Claude with prompt caching on ----
    const client = new Anthropic()
    const response = await client.messages.create({
      model: NUTRITION_COACH_PERSONA.model,
      max_tokens: NUTRITION_COACH_PERSONA.maxTokens,
      system: blocks as unknown as Anthropic.TextBlockParam[],
      messages: conversation,
    })
    logCacheMetrics(response, 'nutrition-coach')

    const finalResponse = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n\n')
      .trim()

    // ---- 4. Persist both sides ----
    if (finalResponse) {
      await persistCoachMessages(userMessage, finalResponse)
    }

    return Response.json({
      response: finalResponse,
      coachContext: coachContextSections,
    })
  } catch (error: unknown) {
    console.error('[nutrition-coach] route error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ error: message }, { status: 500 })
  }
}
