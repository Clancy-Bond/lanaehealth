/**
 * AI Chat API Route
 *
 * POST /api/chat
 * Body: { message: string }
 *
 * Two response shapes are supported off the same handler:
 *
 *   - Default (JSON): drains the chat pipeline and returns
 *     { response, toolsUsed, citations } as a single body. Preserved
 *     for any external client / test that already speaks JSON.
 *
 *   - SSE (Accept: text/event-stream): streams the same pipeline as
 *     server-sent events so the v2 chat surface can render
 *     "Reviewing your records..." -> tokens flowing -> citations as
 *     soon as each phase completes. Events emitted (in order):
 *
 *       context  -> retrieved metadata (citations + summary topics)
 *       tool     -> each tool call as it runs (live trace)
 *       token    -> each text delta from Claude
 *       done     -> { full_response, toolsUsed, citations }
 *       error    -> non-fatal error string before close
 *
 *     The dynamic patient context (permanent core, summaries,
 *     retrieval) is built ONCE per turn via the Context Assembler,
 *     so citations on both JSON and SSE paths come from the same
 *     `AssembledSections` structure.
 */

import Anthropic from '@anthropic-ai/sdk'
import {
  getFullSystemPromptCached,
  type AssembledSections,
} from '@/lib/context/assembler'
import { trace } from '@/lib/observability/tracing'
import { logError } from '@/lib/observability/log'
import { logCacheMetrics } from '@/lib/ai/cache-metrics'
import { CHAT_TOOLS, executeTool } from '@/lib/ai/chat-tools'
import { createServiceClient } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth/require-user'
import { resolveUserId, UserIdUnresolvableError } from '@/lib/auth/resolve-user-id'
import { checkRateLimit, clientIdFromRequest } from '@/lib/security/rate-limit'
import { recordAuditEvent, auditMetaFromRequest } from '@/lib/security/audit-log'
import { wrapUserContent } from '@/lib/ai/safety/wrap-user-content'

export const dynamic = 'force-dynamic'
// Vercel Pro max is 300s. Lanae's "look at my full picture" prompts
// trigger 4-6 tool iterations at ~40s each; 120s was clipping them at
// iteration 3 and returning "Request failed". 300s is Vercel Pro's
// hard cap -- if we need longer we'll need streaming responses, not
// a longer function. SSE keeps the connection live the whole time so
// the user actually sees progress instead of a 4-minute spinner.
export const maxDuration = 300

const MAX_USER_MESSAGE_CHARS = 16_000

const MAX_TOOL_ITERATIONS = 20
const MAX_HISTORY_MESSAGES = 50
const MODEL = 'claude-sonnet-4-6'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  tools_used: string[] | null
  created_at: string
}

/**
 * Citation surfaced to the v2 client. One per retrieved record or
 * loaded summary. The client uses `kind` + `date` to deep-link into
 * the matching v2 surface (e.g. /v2/cycle?date=...) so the user can
 * audit the exact data point that informed any claim.
 */
export interface ChatCitation {
  kind: 'retrieval' | 'summary'
  /** Human-readable label, e.g. "Cycle entry 2026-04-18". */
  label: string
  /** Source content type, e.g. "cycle_entry", "oura_daily". */
  contentType?: string
  /** ISO date YYYY-MM-DD when known. */
  date?: string
  /** v2 deep-link target if we have one for this kind. */
  href?: string
}

function citationsFromSections(sections: AssembledSections): ChatCitation[] {
  const out: ChatCitation[] = []

  // Layer 3: per-day pgvector / FTS hits. These are the strongest
  // citations because each one points at a specific dated record.
  if (sections.retrieval) {
    const lines = sections.retrieval.split('\n\n')
    for (const line of lines) {
      // The assembler emits each entry as
      //   "[YYYY-MM-DD] (content_type[, phase][, pain N/10]) narrative..."
      const headMatch = line.match(/^\[([0-9]{4}-[0-9]{2}-[0-9]{2})\]\s*\(([^)]*)\)/)
      if (!headMatch) continue
      const date = headMatch[1]
      const meta = headMatch[2]
      const contentType = meta.split(',')[0]?.trim() ?? 'record'
      out.push({
        kind: 'retrieval',
        label: `${prettyContentType(contentType)} ${date}`,
        contentType,
        date,
        href: hrefForContentType(contentType, date),
      })
    }
  }

  // Layer 2: smart summaries that fed the answer.
  for (const s of sections.summaries) {
    out.push({
      kind: 'summary',
      label: prettySummaryTopic(s.topic),
      contentType: s.topic,
    })
  }

  return out
}

function prettyContentType(contentType: string): string {
  switch (contentType) {
    case 'cycle_entry':
    case 'cycle':
      return 'Cycle entry'
    case 'oura_daily':
    case 'oura':
      return 'Oura recording'
    case 'symptom':
    case 'symptoms':
      return 'Symptom log'
    case 'food_entry':
    case 'food':
      return 'Food log'
    case 'lab_result':
    case 'lab':
      return 'Lab result'
    case 'daily_log':
      return 'Daily log'
    default:
      return contentType.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
  }
}

function hrefForContentType(contentType: string, date: string): string | undefined {
  switch (contentType) {
    case 'cycle_entry':
    case 'cycle':
      return `/v2/cycle?date=${date}`
    case 'oura_daily':
    case 'oura':
      return `/v2/sleep?date=${date}`
    case 'food_entry':
    case 'food':
      return `/v2/calories?date=${date}`
    case 'symptom':
    case 'symptoms':
    case 'daily_log':
      return `/v2/today?date=${date}`
    default:
      return undefined
  }
}

function prettySummaryTopic(topic: string): string {
  return `Summary, ${topic.replace(/_/g, ' ')}`
}

// ── Pipeline events ─────────────────────────────────────────────────

type PipelineEvent =
  | { type: 'context'; citations: ChatCitation[]; tokenEstimate: number }
  | { type: 'tool'; name: string }
  | { type: 'token'; delta: string }
  | { type: 'done'; fullResponse: string; toolsUsed: string[]; citations: ChatCitation[] }
  | { type: 'error'; message: string }

/**
 * Runs the full chat turn (assembler -> tool-use loop -> persistence)
 * and yields events as each phase produces output. Both the JSON and
 * SSE response paths consume this generator.
 *
 * Persistence runs only when streaming completes successfully; if the
 * generator throws or the connection is aborted, no chat_messages
 * rows are written.
 */
async function* runChatTurn(
  userMessage: string,
  userId: string,
  audit: ReturnType<typeof auditMetaFromRequest>,
): AsyncGenerator<PipelineEvent, void, unknown> {
  // ---- 1. Assemble system prompt with patient context ----
  const { system: cachedSystem, sections, tokenEstimate } =
    await getFullSystemPromptCached(userMessage, { userId })

  const citations = citationsFromSections(sections)
  yield { type: 'context', citations, tokenEstimate }

  // ---- 2. Load conversation history (scoped to this user) ----
  const supabase = createServiceClient()
  const { data: historyRows } = await supabase
    .from('chat_messages')
    .select('role, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(MAX_HISTORY_MESSAGES)

  const conversationHistory: Anthropic.MessageParam[] = (historyRows || []).map(
    (row: Pick<ChatMessage, 'role' | 'content'>) => ({
      role: row.role as 'user' | 'assistant',
      content: row.content,
    }),
  )

  conversationHistory.push({
    role: 'user',
    content: wrapUserContent('message', userMessage),
  })

  // ---- 3. Tool-use loop. The final iteration uses streaming so we ----
  //         can flush tokens to the client live; intermediate iterations
  //         stay non-streaming because they will be discarded once tools
  //         resolve and we re-prompt.
  const client = new Anthropic()
  const toolsUsed: string[] = []
  let finalResponse = ''
  let messages = [...conversationHistory]

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: cachedSystem as unknown as Anthropic.TextBlockParam[],
      tools: CHAT_TOOLS as Anthropic.Tool[],
      messages,
    })
    logCacheMetrics(response, `chat:iter${i}`)

    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === 'text',
    )
    const toolBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    )

    // Terminal turn. Stream the assistant's final text token-by-token
    // so SSE clients see it flow. We already have the full text in
    // `textBlocks` (above), but emitting it through a token stream
    // gives both code paths the same shape: callers iterate events,
    // and the JSON path collects them into `finalResponse`.
    if (response.stop_reason === 'end_turn' || toolBlocks.length === 0) {
      const text = textBlocks.map((b) => b.text).join('\n\n')
      // Chunk into ~20-character fragments so the SSE feels live
      // without overwhelming the wire with 1-byte events.
      const CHUNK = 24
      for (let off = 0; off < text.length; off += CHUNK) {
        const delta = text.slice(off, off + CHUNK)
        finalResponse += delta
        yield { type: 'token', delta }
      }
      break
    }

    // Process tool calls. Emit each tool name as it is invoked so the
    // SSE client can render a live "Pulling Oura..." style trace.
    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const toolBlock of toolBlocks) {
      const toolName = toolBlock.name
      if (!toolsUsed.includes(toolName)) {
        toolsUsed.push(toolName)
      }
      yield { type: 'tool', name: toolName }

      const result = await executeTool(
        toolName,
        (toolBlock.input as Record<string, unknown>) || {},
      )

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolBlock.id,
        content: result,
      })
    }

    messages = [
      ...messages,
      { role: 'assistant' as const, content: response.content },
      { role: 'user' as const, content: toolResults },
    ]
  }

  if (!finalResponse) {
    finalResponse =
      'I was still gathering data but hit the tool use limit. Here is what I have so far based on the tools I called. Please try asking again with a more specific question.'
    yield { type: 'token', delta: finalResponse }
  }

  // ---- 4. Persist + audit ----
  const now = new Date().toISOString()

  await supabase.from('chat_messages').insert([
    {
      user_id: userId,
      role: 'user',
      content: userMessage,
      tools_used: null,
      created_at: now,
    },
    {
      user_id: userId,
      role: 'assistant',
      content: finalResponse,
      tools_used: toolsUsed.length > 0 ? toolsUsed : null,
      created_at: new Date(Date.now() + 1).toISOString(),
    },
  ])

  await recordAuditEvent({
    endpoint: 'POST /api/chat',
    actor: `via:`,
    outcome: 'allow',
    status: 200,
    bytes: Buffer.byteLength(finalResponse, 'utf8'),
    ip: audit.ip,
    userAgent: audit.userAgent,
    meta: { tools_used: toolsUsed },
  })

  yield { type: 'done', fullResponse: finalResponse, toolsUsed, citations }
}

// ── SSE encoding helpers ────────────────────────────────────────────

function sseLine(event: string, data: unknown): string {
  // SSE wire format: `event: NAME\n` then one or more `data: JSON\n`
  // lines, terminated by a blank line. The JSON.stringify guarantees
  // single-line payloads so we never split a record across frames.
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function buildSseStream(
  generator: AsyncGenerator<PipelineEvent, void, unknown>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const event of generator) {
          let line: string
          switch (event.type) {
            case 'context':
              line = sseLine('context', {
                citations: event.citations,
                tokenEstimate: event.tokenEstimate,
              })
              break
            case 'tool':
              line = sseLine('tool', { name: event.name })
              break
            case 'token':
              line = sseLine('token', event.delta)
              break
            case 'done':
              line = sseLine('done', {
                full_response: event.fullResponse,
                toolsUsed: event.toolsUsed,
                citations: event.citations,
              })
              break
            case 'error':
              line = sseLine('error', { message: event.message })
              break
          }
          controller.enqueue(encoder.encode(line))
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'stream failed'
        // Never leak raw error text (could include prompt fragments
        // and therefore PHI). The client only needs to know it broke.
        console.error('Chat SSE stream error:', msg)
        controller.enqueue(
          encoder.encode(sseLine('error', { message: 'Chat request failed' })),
        )
      } finally {
        controller.close()
      }
    },
  })
}

// ── Route handler ───────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  return trace(
    { name: 'POST /api/chat', op: 'ai.chat_completion' },
    async () => handleChatPost(request),
  )
}

async function handleChatPost(request: Request): Promise<Response> {
  const audit = auditMetaFromRequest(request)
  const auth = requireAuth(request)
  if (!auth.ok) {
    await recordAuditEvent({
      endpoint: 'POST /api/chat',
      actor: audit.ip ?? 'unauthenticated',
      outcome: 'deny',
      status: 401,
      reason: 'auth',
      ip: audit.ip,
      userAgent: audit.userAgent,
    })
    return auth.response
  }

  // Chat is the hottest Anthropic call site (tool-use loop up to 20
  // iterations). 30 turns per 5 minutes is plenty for a real user and
  // blunts a leaked-cookie cost-burn scenario.
  const limit = checkRateLimit({
    scope: 'chat:turn',
    max: 30,
    windowMs: 5 * 60 * 1000,
    key: clientIdFromRequest(request),
  })
  if (!limit.ok) {
    await recordAuditEvent({
      endpoint: 'POST /api/chat',
      actor: `via:`,
      outcome: 'deny',
      status: 429,
      reason: 'rate-limit',
      ip: audit.ip,
      userAgent: audit.userAgent,
    })
    return Response.json({ error: 'Rate limit exceeded.' }, { status: 429 })
  }

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
      return Response.json(
        { error: 'Message cannot be empty' },
        { status: 400 },
      )
    }
    if (userMessage.length > MAX_USER_MESSAGE_CHARS) {
      return Response.json(
        { error: `Message exceeds ${MAX_USER_MESSAGE_CHARS}-character limit.` },
        { status: 413 },
      )
    }

    // Resolve which user this turn belongs to. Multi-user safe via the
    // Supabase session; legacy iOS Shortcut / cron path falls back to
    // OWNER_USER_ID env so a single-secret caller can still open the
    // owner's chat.
    let userId: string
    try {
      const r = await resolveUserId()
      userId = r.userId
    } catch (err) {
      if (err instanceof UserIdUnresolvableError) {
        return Response.json({ error: 'unauthenticated' }, { status: 401 })
      }
      return Response.json({ error: 'auth check failed' }, { status: 500 })
    }

    const wantsSse = (request.headers.get('accept') ?? '').includes('text/event-stream')
    const generator = runChatTurn(userMessage, userId, audit)

    if (wantsSse) {
      const stream = buildSseStream(generator)
      return new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          // Keep proxies (CDN, Vercel edge) from buffering the stream.
          'X-Accel-Buffering': 'no',
          Connection: 'keep-alive',
        },
      })
    }

    // JSON path: drain the generator and assemble a single response.
    let fullResponse = ''
    let toolsUsed: string[] = []
    let citations: ChatCitation[] = []
    for await (const event of generator) {
      if (event.type === 'done') {
        fullResponse = event.fullResponse
        toolsUsed = event.toolsUsed
        citations = event.citations
      }
    }

    return Response.json({
      response: fullResponse,
      toolsUsed,
      citations,
    })
  } catch (error: unknown) {
    // PHI hygiene: error.message from Anthropic can echo the assembled
    // prompt. Pass through logError so the structured logger and Sentry
    // both see it; the Sentry scrubber strips known PHI keys before the
    // event leaves the process.
    logError({
      context: 'chat:handler',
      error,
      tags: { ip_present: Boolean(audit.ip) },
    })
    await recordAuditEvent({
      endpoint: 'POST /api/chat',
      actor: `via:`,
      outcome: 'error',
      status: 500,
      reason: 'handler-exception',
      ip: audit.ip,
      userAgent: audit.userAgent,
    })
    // Generic error. Raw error messages from Anthropic can include the
    // assembled prompt (which holds PHI); surfacing them would leak.
    return Response.json({ error: 'Chat request failed' }, { status: 500 })
  }
}
