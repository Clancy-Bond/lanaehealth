/**
 * AI Chat API Route
 *
 * POST /api/chat
 * Body: { message: string }
 *
 * Uses the Context Assembler to build a system prompt with patient data,
 * then runs Claude with tool use loop until a final text response.
 */

import Anthropic from '@anthropic-ai/sdk'
import { getFullSystemPromptCached } from '@/lib/context/assembler'
import { logCacheMetrics } from '@/lib/ai/cache-metrics'
import { CHAT_TOOLS, executeTool } from '@/lib/ai/chat-tools'
import { createServiceClient } from '@/lib/supabase'
import { requireUser } from '@/lib/auth/require-user'
import { checkRateLimit, clientIdFromRequest } from '@/lib/security/rate-limit'
import { recordAuditEvent, auditMetaFromRequest } from '@/lib/security/audit-log'
import { wrapUserContent } from '@/lib/ai/safety/wrap-user-content'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

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

export async function POST(request: Request) {
  const audit = auditMetaFromRequest(request)
  const auth = await requireUser(request)
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
      actor: auth.user.id,
      outcome: 'deny',
      status: 429,
      reason: 'rate-limit',
      ip: audit.ip,
      userAgent: audit.userAgent,
    })
    return Response.json({ error: 'Rate limit exceeded.' }, { status: 429 })
  }

  try {
    const body = await request.json() as { message?: string }

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

    // ---- 1. Assemble system prompt with patient context ----
    // Cached variant: static identity/rules prefix is cached ephemerally,
    // dynamic patient context stays fresh. Chat is the hottest call site
    // (up to 20 tool-use iterations per request), so cache hits here
    // dominate the savings.
    const { system: cachedSystem } = await getFullSystemPromptCached(userMessage)

    // ---- 2. Load conversation history ----
    const supabase = createServiceClient()
    const { data: historyRows } = await supabase
      .from('chat_messages')
      .select('role, content, created_at')
      .order('created_at', { ascending: true })
      .limit(MAX_HISTORY_MESSAGES)

    const conversationHistory: Anthropic.MessageParam[] = (historyRows || []).map(
      (row: Pick<ChatMessage, 'role' | 'content'>) => ({
        role: row.role as 'user' | 'assistant',
        content: row.content,
      }),
    )

    // Add current user message wrapped in a delimited block. The system
    // prompt now instructs Claude to treat content inside <user_*> tags as
    // untrusted data, neutralizing prompt-injection phrasing.
    conversationHistory.push({
      role: 'user',
      content: wrapUserContent('message', userMessage),
    })

    // ---- 3. Call Claude with tool use loop ----
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

      // Check for text content and tool use blocks
      const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === 'text',
      )
      const toolBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
      )

      // If stop reason is end_turn or no tool use, we are done
      if (response.stop_reason === 'end_turn' || toolBlocks.length === 0) {
        finalResponse = textBlocks.map((b) => b.text).join('\n\n')
        break
      }

      // Process tool calls
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const toolBlock of toolBlocks) {
        const toolName = toolBlock.name
        if (!toolsUsed.includes(toolName)) {
          toolsUsed.push(toolName)
        }

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

      // Add assistant message (with tool use) and tool results to conversation
      messages = [
        ...messages,
        { role: 'assistant' as const, content: response.content },
        { role: 'user' as const, content: toolResults },
      ]
    }

    // If we exhausted iterations without a final response, use whatever text we have
    if (!finalResponse) {
      finalResponse = 'I was still gathering data but hit the tool use limit. Here is what I have so far based on the tools I called. Please try asking again with a more specific question.'
    }

    // ---- 4. Save messages to database ----
    const now = new Date().toISOString()

    await supabase.from('chat_messages').insert([
      {
        role: 'user',
        content: userMessage,
        tools_used: null,
        created_at: now,
      },
      {
        role: 'assistant',
        content: finalResponse,
        tools_used: toolsUsed.length > 0 ? toolsUsed : null,
        created_at: new Date(Date.now() + 1).toISOString(), // +1ms to preserve order
      },
    ])

    await recordAuditEvent({
      endpoint: 'POST /api/chat',
      actor: auth.user.id,
      outcome: 'allow',
      status: 200,
      bytes: Buffer.byteLength(finalResponse, 'utf8'),
      ip: audit.ip,
      userAgent: audit.userAgent,
      meta: { tools_used: toolsUsed },
    })

    return Response.json({
      response: finalResponse,
      toolsUsed,
    })
  } catch (error: unknown) {
    console.error('Chat API error:', error)
    await recordAuditEvent({
      endpoint: 'POST /api/chat',
      actor: auth.user.id,
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
